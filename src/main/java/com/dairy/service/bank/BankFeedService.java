package com.dairy.service.bank;

import com.dairy.model.Category;
import com.dairy.model.Expense;
import com.dairy.model.Income;
import com.dairy.model.bank.BankRule;
import com.dairy.model.bank.BankTransaction;
import com.dairy.repo.CategoryRepository;
import com.dairy.repo.ExpenseRepository;
import com.dairy.repo.IncomeRepository;
import com.dairy.repo.bank.BankRuleRepository;
import com.dairy.repo.bank.BankTransactionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * The bank feed: fetches the Kotak statement, files each new line and maps it to the books.
 *
 * Mapping order, first hit wins:
 *   1. an existing ledger entry of the same amount within a few days (so a payment someone already
 *      entered by hand is linked, not booked twice) - MAPPED
 *   2. a learned rule whose pattern is in the narration - MAPPED, posting a ledger entry
 *   3. a built-in keyword guess against the ledger's own categories - SUGGESTED, posted on approval
 *   4. otherwise UNMAPPED, for someone to pick a category; that choice can be remembered as a rule
 */
@Service
public class BankFeedService {

    private static final Logger logger = LoggerFactory.getLogger(BankFeedService.class);
    private static final ZoneId ZONE = ZoneId.of("Asia/Kolkata");
    /** Ledger entries this many days either side of the bank date count as the same payment. */
    private static final int MATCH_DAYS = 3;
    /** Daily milk revenue, booked from dispatches and AMCS. Paid in lump sums, never one-to-one. */
    private static final String MILK_SALES = "MILK_SALES";
    /** Rule kind: the party is a member of staff; their lines are always left for a person to choose. */
    static final String EMPLOYEE = "EMPLOYEE";

    /** Narration keyword -> words to look for in the ledger's category names (first found wins). */
    private static final Map<String, List<String>> DEBIT_GUESSES = new LinkedHashMap<>();
    private static final Map<String, List<String>> CREDIT_GUESSES = new LinkedHashMap<>();
    static {
        DEBIT_GUESSES.put("SALARY", List.of("SALAR", "WAGE", "LABOU"));
        DEBIT_GUESSES.put("WAGES", List.of("WAGE", "SALAR", "LABOU"));
        DEBIT_GUESSES.put("FEED", List.of("FEED"));
        DEBIT_GUESSES.put("FODDER", List.of("FODDER", "FEED"));
        DEBIT_GUESSES.put("CATTLE", List.of("FEED"));
        DEBIT_GUESSES.put("VET", List.of("MEDIC", "VET"));
        DEBIT_GUESSES.put("MEDICAL", List.of("MEDIC", "VET"));
        DEBIT_GUESSES.put("PHARMA", List.of("MEDIC", "VET"));
        DEBIT_GUESSES.put("BESCOM", List.of("ELECTRIC", "POWER", "UTILIT"));
        DEBIT_GUESSES.put("ELECTRICITY", List.of("ELECTRIC", "POWER", "UTILIT"));
        DEBIT_GUESSES.put("DIESEL", List.of("FUEL", "DIESEL", "TRANSPORT"));
        DEBIT_GUESSES.put("PETROL", List.of("FUEL", "PETROL", "TRANSPORT"));
        DEBIT_GUESSES.put("FUEL", List.of("FUEL", "TRANSPORT"));
        DEBIT_GUESSES.put("RENT", List.of("RENT", "LEASE"));
        DEBIT_GUESSES.put("SEMEN", List.of("BREED", "AI", "SEMEN"));
        DEBIT_GUESSES.put("INSEMINATION", List.of("BREED", "AI", "SEMEN"));
        DEBIT_GUESSES.put("REPAIR", List.of("MAINTEN", "REPAIR"));
        CREDIT_GUESSES.put("SUBSIDY", List.of("SUBSID", "GRANT"));
        CREDIT_GUESSES.put("MANURE", List.of("MANURE", "DUNG"));
        CREDIT_GUESSES.put("DUNG", List.of("MANURE", "DUNG"));
        CREDIT_GUESSES.put("CALF", List.of("ANIMAL", "CATTLE", "CALF"));
    }
    /** Narration words that mean the milk society paying us: a settlement of the MILK_SALES income. */
    private static final List<String> SOCIETY_WORDS = List.of("BAMUL", "MPCS", "MILK", "DCS", "DAIRY CO");
    private static final List<String> CHARGE_WORDS = List.of("CHARGES", "CHRG", "CHG ", "GST ON", "SMS ALERT", "AMC ");

    /** Narration tokens that never name the other party. */
    private static final Set<String> NOISE = Set.of("UPI", "NEFT", "IMPS", "RTGS", "INW", "INWARD", "OUT", "OUTWARD",
        "MB", "IB", "NB", "DR", "CR", "TO", "FROM", "BY", "TRF", "TRANSFER", "PAYMENT", "PAY", "SENT", "RECEIVED",
        "REF", "CHQ", "CHEQUE", "CLG", "ATM", "POS", "ACH", "NACH", "ECS", "MOB", "MOBFT", "FT", "BIL", "BILLPAY",
        "INB", "INFT", "OTHPG", "PG", "THE", "LTD", "PVT", "AND", "FOR", "KKBK", "YESB", "HDFC", "ICIC", "SBIN");

    @Autowired private KotakClient kotakClient;
    @Autowired private BankTransactionRepository txnRepository;
    @Autowired private BankRuleRepository ruleRepository;
    @Autowired private ExpenseRepository expenseRepository;
    @Autowired private IncomeRepository incomeRepository;
    @Autowired private CategoryRepository categoryRepository;

    /** How far back the very first fetch reaches. */
    @Value("${kotak.fetch.initial-days:90}")
    private int initialDays;

    public Map<String, Object> status() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("configured", kotakClient.isConfigured());
        out.put("accountLast4", kotakClient.accountLast4());
        out.put("lastFetchedAt", txnRepository.findLastFetchedAt());
        out.put("latestTxnDate", txnRepository.findLatestTxnDate());
        out.put("unmapped", txnRepository.countByStatus("UNMAPPED"));
        out.put("suggested", txnRepository.countByStatus("SUGGESTED"));
        return out;
    }

    /**
     * Fetch from Kotak and file the new lines. Without dates: from a few days before the newest line
     * we hold (catches late postings; duplicates are skipped) to today.
     */
    @Transactional
    public Map<String, Object> fetch(LocalDate from, LocalDate to) {
        LocalDate today = LocalDate.now(ZONE);
        if (to == null || to.isAfter(today)) to = today;
        if (from == null) {
            LocalDate latest = txnRepository.findLatestTxnDate();
            from = latest != null ? latest.minusDays(5) : today.minusDays(initialDays);
        }
        List<KotakClient.StatementLine> lines = kotakClient.fetchStatement(from, to);
        Map<String, Object> summary = importLines(lines);
        summary.put("from", from);
        summary.put("to", to);
        logger.info("Kotak {}..{}: {}", from, to, summary);
        return summary;
    }

    /**
     * A statement downloaded from Kotak net banking, run through the same filing and mapping as a
     * fetch. Lines the API (or an earlier file) already brought in are skipped.
     */
    @Transactional
    public Map<String, Object> importFile(byte[] bytes, String fileName) {
        String name = Optional.ofNullable(fileName).orElse("").toLowerCase(Locale.ROOT);
        if (name.endsWith(".xls") || name.endsWith(".xlsx")) {
            throw new IllegalArgumentException("Download the statement from Kotak net banking as CSV and import that");
        }
        StatementFileParser.Parsed parsed = StatementFileParser.read(bytes);
        List<KotakClient.StatementLine> lines = parsed.lines();
        if (lines.isEmpty()) throw new IllegalArgumentException("No transactions found in " + fileName);
        Map<String, Object> summary = importLines(lines,
            parsed.accountLast4() != null ? parsed.accountLast4() : kotakClient.accountLast4());
        summary.put("from", lines.stream().map(KotakClient.StatementLine::date).min(Comparator.naturalOrder()).get());
        summary.put("to", lines.stream().map(KotakClient.StatementLine::date).max(Comparator.naturalOrder()).get());
        logger.info("Statement file {}: {}", fileName, summary);
        return summary;
    }

    Map<String, Object> importLines(List<KotakClient.StatementLine> lines) {
        return importLines(lines, kotakClient.accountLast4());
    }

    Map<String, Object> importLines(List<KotakClient.StatementLine> lines, String last4) {
        Map<String, KotakClient.StatementLine> byKey = new LinkedHashMap<>();
        for (KotakClient.StatementLine line : lines) byKey.putIfAbsent(dedupeKey(line), line);
        Set<String> existing = byKey.isEmpty() ? Set.of() : txnRepository.findExistingKeys(byKey.keySet());

        List<BankTransaction> fresh = new ArrayList<>();
        byKey.forEach((key, line) -> {
            if (existing.contains(key)) return;
            BankTransaction t = new BankTransaction();
            t.setDedupeKey(key);
            t.setBankRef(truncate(line.ref(), 100));
            t.setAccountLast4(last4);
            t.setTxnDate(line.date());
            t.setNarration(truncate(line.narration(), 500));
            t.setAmount(line.amount());
            t.setDirection(line.credit() ? "CREDIT" : "DEBIT");
            t.setBalance(line.balance());
            t.setMode(modeOf(line.narration()));
            t.setCounterparty(truncate(counterpartyOf(line.narration()), 120));
            fresh.add(t);
        });
        fresh.sort(Comparator.comparing(BankTransaction::getTxnDate));
        Map<String, Integer> counts = autoMap(fresh);

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("received", lines.size());
        summary.put("new", fresh.size());
        summary.put("mapped", counts.getOrDefault("MAPPED", 0));
        summary.put("suggested", counts.getOrDefault("SUGGESTED", 0));
        summary.put("unmapped", counts.getOrDefault("UNMAPPED", 0));
        summary.put("ignored", counts.getOrDefault("IGNORED", 0));
        return summary;
    }

    /** Runs the mapping order over lines that are not yet accounted for, saving each. */
    private Map<String, Integer> autoMap(List<BankTransaction> txns) {
        if (txns.isEmpty()) return Map.of();
        LocalDate min = txns.stream().map(BankTransaction::getTxnDate).min(Comparator.naturalOrder()).get();
        LocalDate max = txns.stream().map(BankTransaction::getTxnDate).max(Comparator.naturalOrder()).get();
        List<Expense> expenses = new ArrayList<>(expenseRepository.findByDateBetween(min.minusDays(MATCH_DAYS), max.plusDays(MATCH_DAYS)));
        List<Income> incomes = new ArrayList<>(incomeRepository.findByDateBetween(min.minusDays(MATCH_DAYS), max.plusDays(MATCH_DAYS)));
        Set<Long> takenExpenses = new HashSet<>(txnRepository.findLedgerIdsByKind("EXPENSE"));
        Set<Long> takenIncomes = new HashSet<>(txnRepository.findLedgerIdsByKind("INCOME"));
        List<BankRule> rules = ruleRepository.findAll();
        List<Category> categories = categoryRepository.findAll();

        Map<String, Integer> counts = new HashMap<>();
        for (BankTransaction t : txns) {
            BankRule first = ruleFor(t, rules);
            if (first != null && EMPLOYEE.equals(first.getKind())) {
                // An employee's money is never booked by itself, not even against a ledger entry of the same amount.
                markEmployee(t, first);
                txnRepository.save(t);
                counts.merge(t.getStatus(), 1, Integer::sum);
                continue;
            }
            boolean credit = "CREDIT".equals(t.getDirection());
            if (credit) {
                Income hit = closest(incomes, t, Income::getDate, Income::getAmount, Income::getId, takenIncomes,
                    i -> !MILK_SALES.equals(i.getCategory()));
                if (hit != null) link(t, "INCOME", hit.getId(), hit.getCategory(), hit.getSegment(), hit.getDate());
            } else {
                Expense hit = closest(expenses, t, Expense::getDate, Expense::getAmount, Expense::getId, takenExpenses, e -> true);
                if (hit != null) link(t, "EXPENSE", hit.getId(), hit.getCategory(), hit.getSegment(), hit.getDate());
            }
            if (t.getLedgerId() == null) {
                BankRule rule = ruleFor(t, rules);
                if (rule != null) applyRule(t, rule);
                else guess(t, categories);
            }
            txnRepository.save(t);
            counts.merge(t.getStatus(), 1, Integer::sum);
        }
        return counts;
    }

    /** The unclaimed ledger entry of the same amount (to the rupee) nearest the bank date, if any. */
    private static <T> T closest(List<T> entries, BankTransaction t, Function<T, LocalDate> date,
                                 Function<T, Double> amount, Function<T, Long> id, Set<Long> taken,
                                 java.util.function.Predicate<T> eligible) {
        T best = null;
        long bestGap = Long.MAX_VALUE;
        for (T e : entries) {
            if (taken.contains(id.apply(e)) || !eligible.test(e) || amount.apply(e) == null) continue;
            if (Math.abs(amount.apply(e) - t.getAmount()) >= 1) continue;
            long gap = Math.abs(ChronoUnit.DAYS.between(date.apply(e), t.getTxnDate()));
            if (gap <= MATCH_DAYS && gap < bestGap) {
                best = e;
                bestGap = gap;
            }
        }
        if (best != null) taken.add(id.apply(best));
        return best;
    }

    private static void link(BankTransaction t, String kind, Long ledgerId, String category, String segment, LocalDate date) {
        t.setStatus("MAPPED");
        t.setKind(kind);
        t.setLedgerId(ledgerId);
        t.setPosted(false);
        t.setCategory(category);
        t.setSegment(segment);
        t.setMatchReason("Matches the ledger entry of " + date);
    }

    private static BankRule ruleFor(BankTransaction t, List<BankRule> rules) {
        return rules.stream()
            .filter(r -> ("ANY".equals(r.getDirection()) || r.getDirection().equals(t.getDirection()))
                && matches(t.getNarration(), r.getPattern()))
            .max(Comparator.comparingInt(r -> r.getPattern().length()))
            .orElse(null);
    }

    /**
     * Every word of the pattern is somewhere in the narration. Kotak writes the same party in
     * different ways - "GOPAL  S O RAMASWAMI REDDY", "SentIMPS629208547469LOKESH G/..." - so the
     * words are looked for, not the exact text.
     */
    static boolean matches(String narration, String pattern) {
        String n = normal(narration);
        String[] words = normal(pattern).split(" ");
        if (words.length == 0 || words[0].isEmpty()) return false;
        for (String w : words) {
            if (!n.contains(w)) return false;
        }
        return true;
    }

    private static String normal(String s) {
        return Optional.ofNullable(s).orElse("").toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]+", " ").trim();
    }

    /** Lines from someone on an employee rule wait for a person to say what each one is. */
    private void markEmployee(BankTransaction t, BankRule rule) {
        rule.setHits(rule.getHits() + 1);
        rule.setLastUsed(LocalDateTime.now());
        ruleRepository.save(rule);
        t.setRuleId(rule.getId());
        t.setStatus("UNMAPPED");
        t.setKind(null);
        t.setCategory(null);
        t.setMatchReason("Employee " + rule.getPattern() + ": choose salary, purchase, reimbursement or advance");
        t.setEmployee(rule.getPattern());
    }

    private void applyRule(BankTransaction t, BankRule rule) {
        if (EMPLOYEE.equals(rule.getKind())) {
            markEmployee(t, rule);
            return;
        }
        rule.setHits(rule.getHits() + 1);
        rule.setLastUsed(LocalDateTime.now());
        ruleRepository.save(rule);
        t.setRuleId(rule.getId());
        t.setMatchReason("Rule: " + rule.getPattern());
        if ("IGNORE".equals(rule.getKind())) {
            t.setStatus("IGNORED");
            t.setKind(null);
            return;
        }
        book(t, rule.getKind(), rule.getCategory(), rule.getSegment(), null);
    }

    private void guess(BankTransaction t, List<Category> categories) {
        String narration = Optional.ofNullable(t.getNarration()).orElse("").toUpperCase(Locale.ROOT);
        boolean credit = "CREDIT".equals(t.getDirection());
        if (credit && SOCIETY_WORDS.stream().anyMatch(w -> hasWord(narration, w))) {
            suggest(t, "SETTLEMENT", MILK_SALES, "Looks like a milk payment");
            return;
        }
        if (!credit && CHARGE_WORDS.stream().anyMatch(narration::contains)) {
            String bankCharges = findCategory(categories, Category.CategoryType.EXPENSE, List.of("BANK", "CHARGE"));
            if (bankCharges != null) {
                suggest(t, "EXPENSE", bankCharges, "Looks like bank charges");
                return;
            }
        }
        Map<String, List<String>> guesses = credit ? CREDIT_GUESSES : DEBIT_GUESSES;
        Category.CategoryType type = credit ? Category.CategoryType.INCOME : Category.CategoryType.EXPENSE;
        for (Map.Entry<String, List<String>> g : guesses.entrySet()) {
            if (!hasWord(narration, g.getKey())) continue;
            String category = findCategory(categories, type, g.getValue());
            if (category != null) {
                suggest(t, credit ? "INCOME" : "EXPENSE", category, "Narration mentions " + g.getKey());
                return;
            }
        }
        t.setStatus("UNMAPPED");
    }

    /** Whole word only: RENT must not match CURRENT. */
    private static boolean hasWord(String text, String word) {
        return java.util.regex.Pattern.compile("(?<![A-Z])" + java.util.regex.Pattern.quote(word) + "(?![A-Z])")
            .matcher(text).find();
    }

    private static void suggest(BankTransaction t, String kind, String category, String reason) {
        t.setStatus("SUGGESTED");
        t.setKind(kind);
        t.setCategory(category);
        t.setMatchReason(reason);
    }

    /** First category of the type whose name has one of the words. Short words (AI) must be a whole word: not "repAIrs". */
    private static String findCategory(List<Category> categories, Category.CategoryType type, List<String> words) {
        for (String w : words) {
            for (Category c : categories) {
                if (c.getType() != type || c.getName() == null) continue;
                String name = c.getName().toUpperCase(Locale.ROOT);
                if (w.length() <= 3 ? hasWord(name, w) : name.contains(w)) return c.getName();
            }
        }
        return null;
    }

    // ------------------------------------------------------------------ review screen

    /** Lines dated from..to, newest first, with linked ledger entries' current category shown. */
    public List<BankTransaction> list(LocalDate from, LocalDate to) {
        List<BankTransaction> txns = txnRepository.findByTxnDateBetweenOrderByTxnDateDescIdDesc(from, to);
        List<BankRule> employees = ruleRepository.findAll().stream().filter(r -> EMPLOYEE.equals(r.getKind())).toList();
        for (BankTransaction t : txns) {
            BankRule e = ruleFor(t, employees);
            if (e != null) t.setEmployee(e.getPattern());
        }
        return txns;
    }

    /**
     * Someone chose how a line is booked. kind EXPENSE / INCOME / SETTLEMENT / IGNORE.
     * With remember, the choice becomes a rule and is applied to other open lines like it.
     */
    @Transactional
    public Map<String, Object> assign(Long id, String kind, String category, String segment, String note,
                                      boolean remember, String pattern) {
        BankTransaction t = txnRepository.findById(id).orElseThrow(() -> new NoSuchElementException("Bank line " + id + " not found"));
        kind = kind == null ? "" : kind.trim().toUpperCase(Locale.ROOT);
        if (!Set.of("EXPENSE", "INCOME", "SETTLEMENT", "IGNORE").contains(kind)) {
            throw new IllegalArgumentException("Choose expense, income, settlement or ignore");
        }
        if (!"IGNORE".equals(kind) && (category == null || category.isBlank())) {
            throw new IllegalArgumentException("Choose a category");
        }
        if ("EXPENSE".equals(kind) && "CREDIT".equals(t.getDirection())
            || "INCOME".equals(kind) && "DEBIT".equals(t.getDirection())) {
            throw new IllegalArgumentException("Money in is income or a settlement; money out is an expense or a staff settlement");
        }
        t.setNote(blankToNull(note));
        t.setRuleId(null);
        t.setMatchReason("Set by " + currentUser());
        t.setUpdatedBy(currentUser());
        if ("IGNORE".equals(kind)) {
            unbook(t);
            t.setStatus("IGNORED");
        } else {
            book(t, kind, category.trim(), blankToNull(segment), null);
        }
        txnRepository.save(t);

        int alsoMapped = 0;
        boolean employee = ruleRepository.findAll().stream()
            .anyMatch(r -> EMPLOYEE.equals(r.getKind()) && ruleFor(t, List.of(r)) != null);
        if (remember && !employee) {
            String p = Optional.ofNullable(blankToNull(pattern)).orElse(t.getCounterparty());
            if (p != null && p.trim().length() >= 3) {
                BankRule rule = saveRule(p.trim().toUpperCase(Locale.ROOT), t.getDirection(), kind,
                    "IGNORE".equals(kind) ? null : category.trim(), blankToNull(segment));
                alsoMapped = applyRuleToOpen(rule, t.getId());
            }
        }
        return Map.of("transaction", t, "alsoMapped", alsoMapped);
    }

    /** Accept the suggestions on these lines as they are. */
    @Transactional
    public int approve(List<Long> ids) {
        int done = 0;
        for (BankTransaction t : txnRepository.findAllById(ids)) {
            if (!"SUGGESTED".equals(t.getStatus())) continue;
            t.setUpdatedBy(currentUser());
            book(t, t.getKind(), t.getCategory(), t.getSegment(), t.getMatchReason());
            txnRepository.save(t);
            done++;
        }
        return done;
    }

    /** Back to UNMAPPED. A linked entry made by hand stays; one posted by an earlier version is removed. */
    @Transactional
    public BankTransaction reset(Long id) {
        BankTransaction t = txnRepository.findById(id).orElseThrow(() -> new NoSuchElementException("Bank line " + id + " not found"));
        unbook(t);
        t.setStatus("UNMAPPED");
        t.setKind(null);
        t.setCategory(null);
        t.setSegment(null);
        t.setRuleId(null);
        t.setMatchReason(null);
        t.setUpdatedBy(currentUser());
        return txnRepository.save(t);
    }

    /**
     * Books the line as kind. EXPENSE / INCOME keep or create the ledger entry and bring its
     * category and segment in line; SETTLEMENT drops any entry we posted.
     */
    /**
     * Books the line on the bank side only: the Digital Ledger is what staff enter by hand and is
     * never written from here. A link to a ledger entry the line pays is kept while the line stays
     * the same kind (expense or income); SETTLEMENT and a change of kind drop it.
     */
    private void book(BankTransaction t, String kind, String category, String segment, String reason) {
        if ("SETTLEMENT".equals(kind) || (t.getLedgerId() != null && !kind.equals(t.getKind()))) {
            unbook(t);
        }
        t.setStatus("MAPPED");
        t.setKind(kind);
        t.setCategory(category);
        t.setSegment(segment);
        if (reason != null) t.setMatchReason(reason);
    }

    private void unbook(BankTransaction t) {
        if (t.getLedgerId() != null && t.isPosted()) {
            if ("EXPENSE".equals(t.getKind())) expenseRepository.deleteById(t.getLedgerId());
            else if ("INCOME".equals(t.getKind())) incomeRepository.deleteById(t.getLedgerId());
        }
        t.setLedgerId(null);
        t.setPosted(false);
    }

    // ------------------------------------------------------------------ rules

    public List<BankRule> rules() {
        return ruleRepository.findAllByOrderByPatternAsc();
    }

    /**
     * The rules written into this class, in the order a new line meets them, for the Rules tab.
     * Keyword guesses show the ledger category they resolve to today (or that they are skipped).
     */
    public List<Map<String, Object>> builtInRules() {
        List<Category> categories = categoryRepository.findAll();
        List<Map<String, Object>> out = new ArrayList<>();
        out.add(builtIn(1, "ANY", "Same amount as a Digital Ledger entry dated within " + MATCH_DAYS + " days (not for employees)",
            "Linked to that entry (mapped, nothing new booked)",
            "Daily milk income (MILK_SALES) is never matched this way."));
        out.add(builtIn(1, "ANY", "Narration has all the words of one of your employee rules",
            "Left for you to choose: salary, purchase, reimbursement or advance",
            "Checked before anything else, so an employee's money is never booked by itself."));
        out.add(builtIn(2, "ANY", "Narration has all the words of one of your rules",
            "Mapped as that rule says", "Your rules are listed above; the longest one wins."));
        out.add(builtIn(3, "CREDIT", "Narration has the word " + String.join(", ", SOCIETY_WORDS),
            "Suggested: settles milk sales (MILK_SALES)", "A suggestion only, until approved."));
        String charges = findCategory(categories, Category.CategoryType.EXPENSE, List.of("BANK", "CHARGE"));
        out.add(builtIn(3, "DEBIT", "Narration contains " + CHARGE_WORDS.stream().map(String::trim).collect(Collectors.joining(", ")),
            charges != null ? "Suggested: expense \u00b7 " + charges : "Skipped: no ledger category with BANK or CHARGE in its name",
            "A suggestion only, until approved."));
        for (Map.Entry<String, List<String>> g : DEBIT_GUESSES.entrySet()) {
            String c = findCategory(categories, Category.CategoryType.EXPENSE, g.getValue());
            out.add(builtIn(4, "DEBIT", "Narration has the word " + g.getKey(),
                c != null ? "Suggested: expense \u00b7 " + c
                    : "Skipped: no expense category containing " + String.join(" / ", g.getValue()),
                "A suggestion only, until approved."));
        }
        for (Map.Entry<String, List<String>> g : CREDIT_GUESSES.entrySet()) {
            String c = findCategory(categories, Category.CategoryType.INCOME, g.getValue());
            out.add(builtIn(4, "CREDIT", "Narration has the word " + g.getKey(),
                c != null ? "Suggested: income \u00b7 " + c
                    : "Skipped: no income category containing " + String.join(" / ", g.getValue()),
                "A suggestion only, until approved."));
        }
        out.add(builtIn(5, "ANY", "Nothing above applies", "Needs a category (unmapped)", null));
        return out;
    }

    private static Map<String, Object> builtIn(int step, String direction, String when, String then, String note) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("step", step);
        m.put("direction", direction);
        m.put("when", when);
        m.put("then", then);
        if (note != null) m.put("note", note);
        return m;
    }

    public void deleteRule(Long id) {
        ruleRepository.deleteById(id);
    }

    /**
     * A rule typed in on the Rules tab. kind EXPENSE / INCOME / SETTLEMENT / IGNORE, or EMPLOYEE:
     * always leave that person's lines for someone to choose. Applied at once to lines still open.
     */
    @Transactional
    public Map<String, Object> createRule(String pattern, String direction, String kind, String category, String segment) {
        String p = Optional.ofNullable(blankToNull(pattern)).map(x -> normal(x)).orElse("");
        if (p.replace(" ", "").length() < 3) throw new IllegalArgumentException("Type at least 3 letters of the name or narration");
        String k = Optional.ofNullable(kind).orElse("").trim().toUpperCase(Locale.ROOT);
        if (!Set.of("EXPENSE", "INCOME", "SETTLEMENT", "IGNORE", EMPLOYEE).contains(k)) {
            throw new IllegalArgumentException("Choose what the rule does");
        }
        String d = Optional.ofNullable(direction).orElse("").trim().toUpperCase(Locale.ROOT);
        if (EMPLOYEE.equals(k) && d.isEmpty()) d = "ANY";
        if (!Set.of("CREDIT", "DEBIT", "ANY").contains(d)) throw new IllegalArgumentException("Choose money in or money out");
        if ("EXPENSE".equals(k) && !"DEBIT".equals(d) || "INCOME".equals(k) && !"CREDIT".equals(d)) {
            throw new IllegalArgumentException("Purchases are money out; income is money in");
        }
        boolean needsCategory = Set.of("EXPENSE", "INCOME", "SETTLEMENT").contains(k);
        if (needsCategory && blankToNull(category) == null) throw new IllegalArgumentException("Choose a category");
        BankRule rule = saveRule(p, d, k, needsCategory ? category.trim() : null, blankToNull(segment));
        return Map.of("rule", rule, "applied", applyRuleToOpen(rule, null));
    }

    private BankRule saveRule(String pattern, String direction, String kind, String category, String segment) {
        BankRule rule = ruleRepository.findFirstByPatternAndDirection(pattern, direction).orElseGet(BankRule::new);
        rule.setPattern(truncate(pattern, 120));
        rule.setDirection(direction);
        rule.setKind(kind);
        rule.setCategory(category);
        rule.setSegment(segment);
        if (rule.getId() == null) rule.setCreatedBy(currentUser());
        return ruleRepository.save(rule);
    }

    /** A new rule maps the open (unmapped or suggested) lines it fits, not just future ones. */
    private int applyRuleToOpen(BankRule rule, Long skipId) {
        int n = 0;
        List<BankRule> employees = ruleRepository.findAll().stream().filter(r -> EMPLOYEE.equals(r.getKind())).toList();
        for (BankTransaction t : txnRepository.findByStatusIn(List.of("UNMAPPED", "SUGGESTED"))) {
            if (t.getId().equals(skipId) || ruleFor(t, List.of(rule)) == null) continue;
            if (!EMPLOYEE.equals(rule.getKind()) && ruleFor(t, employees) != null) continue; // employees are always asked
            applyRule(t, rule);
            txnRepository.save(t);
            n++;
        }
        return n;
    }

    // ------------------------------------------------------------------ narration parsing

    static String modeOf(String narration) {
        String n = Optional.ofNullable(narration).orElse("").toUpperCase(Locale.ROOT);
        // Charges name the transfer they were for ("CHRG: IMPS TRANSACTION ..."), so check them first.
        if (CHARGE_WORDS.stream().anyMatch(n::contains)) return "CHARGES";
        if (n.contains("UPI")) return "UPI";
        if (n.contains("NEFT")) return "NEFT";
        if (n.contains("IMPS")) return "IMPS";
        if (n.contains("RTGS")) return "RTGS";
        if (n.contains("CHQ") || n.contains("CHEQUE") || n.contains("CLG")) return "CHEQUE";
        if (n.contains("ATM") || n.contains("CASH")) return "CASH";
        if (n.contains("POS") || n.contains("CARD")) return "CARD";
        if (n.startsWith("PG ")) return "ONLINE"; // Kotak: payment gateway, e.g. Amazon Pay
        return "OTHER";
    }

    /**
     * The other party's name from narrations like "UPI/RAMESH FEEDS/412345678901/Payment" or
     * "NEFT INW-HDFCN5202611051234-BAMUL BANGALORE-...": the first part that is not a mode word,
     * a reference number or an IFSC/UTR code.
     */
    static String counterpartyOf(String narration) {
        if (narration == null) return null;
        for (String part : narration.toUpperCase(Locale.ROOT).split("[/|:\\-]+")) {
            String words = Arrays.stream(part.trim().split("\\s+"))
                .map(BankFeedService::withoutReference)
                .filter(w -> !NOISE.contains(w) && !TRANSFER_WORD.matcher(w).matches()
                    && w.replaceAll("[^A-Z]", "").length() >= 2
                    && !w.matches("[A-Z]{4}0[A-Z0-9]{6}")) // IFSC
                .collect(Collectors.joining(" "));
            if (words.replaceAll("[^A-Z]", "").length() >= 3) return words;
        }
        return null;
    }

    /** "SENTIMPS", "RECDNEFT": a mode word with the direction glued on. */
    private static final java.util.regex.Pattern TRANSFER_WORD =
        java.util.regex.Pattern.compile("(SENT|RECD|RCVD|RECEIVED)?(IMPS|NEFT|UPI|RTGS)(TRANS)?");

    /**
     * Reference numbers are dropped, but Kotak glues names onto them ("SENTIMPS629208547469LOKESH"):
     * keep a name of three or more letters after the last digit, if there is one.
     */
    private static String withoutReference(String word) {
        if (!word.matches(".*\\d{4,}.*")) return word;
        String tail = word.replaceAll("^.*\\d", "");
        return tail.length() >= 3 ? tail : "";
    }

    static String dedupeKey(KotakClient.StatementLine line) {
        String base = line.date() + "|" + Math.round(line.amount() * 100) + "|" + (line.credit() ? "C" : "D");
        if (line.ref() != null && !line.ref().isBlank()) return truncate("R|" + line.ref().trim() + "|" + base, 191);
        return "H|" + sha256(base + "|" + Optional.ofNullable(line.narration()).orElse("") + "|" + line.balance());
    }

    private static String sha256(String s) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException(ex);
        }
    }

    private static String currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth == null ? "system" : auth.getName();
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    private static String truncate(String s, int max) {
        return s == null || s.length() <= max ? s : s.substring(0, max);
    }
}
