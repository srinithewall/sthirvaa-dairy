package com.dairy.service.bank;

import com.dairy.model.Expense;
import com.dairy.model.Income;
import com.dairy.model.Staff;
import com.dairy.model.bank.BankTransaction;
import com.dairy.model.bank.SalaryAdvance;
import com.dairy.model.bank.SalaryRule;
import com.dairy.repo.ExpenseRepository;
import com.dairy.repo.IncomeRepository;
import com.dairy.repo.StaffRepository;
import com.dairy.repo.bank.BankTransactionRepository;
import com.dairy.repo.bank.SalaryAdvanceRepository;
import com.dairy.repo.bank.SalaryRuleRepository;
import com.dairy.service.IncomeService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.TreeMap;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Salary rules per employee and what each comes to for a month. See SalaryRule. */
@Service
public class SalaryRuleService {

    @Autowired private SalaryRuleRepository ruleRepository;
    @Autowired private StaffRepository staffRepository;
    @Autowired private ExpenseRepository expenseRepository;
    @Autowired private IncomeService incomeService;
    @Autowired private SalaryAdvanceRepository advanceRepository;
    @Autowired private IncomeRepository incomeRepository;
    @Autowired private BankTransactionRepository bankRepository;

    public List<Map<String, Object>> list() {
        Map<Long, Staff> staff = staffById();
        List<Map<String, Object>> out = new ArrayList<>();
        for (SalaryRule r : ruleRepository.findAll()) {
            Staff s = staff.get(r.getStaffId());
            if (s == null) continue;
            Map<String, Object> row = view(r);
            row.put("staffName", s.getName());
            out.add(row);
        }
        out.sort(Comparator.comparing(m -> m.get("staffName").toString()));
        return out;
    }

    /** Everyone a rule can be set for, with the salary on their staff record. */
    public List<Map<String, Object>> staff() {
        return staffRepository.findAll().stream()
            .sorted(Comparator.comparing(Staff::getName))
            .map(s -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("id", s.getId());
                m.put("name", s.getName());
                m.put("salary", s.getSalary());
                return m;
            }).toList();
    }

    @Transactional
    public Map<String, Object> save(Long staffId, Map<String, Object> body) {
        Staff staff = staffRepository.findById(staffId)
            .orElseThrow(() -> new NoSuchElementException("Staff " + staffId + " not found"));
        String type = body.get("type") == null ? "" : body.get("type").toString().trim().toUpperCase();
        if (!type.equals("FIXED") && !type.equals("DYNAMIC")) throw new IllegalArgumentException("Choose Fixed or Dynamic");

        SalaryRule r = ruleRepository.findByStaffId(staffId).orElseGet(SalaryRule::new);
        r.setStaffId(staffId);
        r.setType(type);
        if (type.equals("FIXED")) {
            Double fixed = positive(body.get("fixedAmount"));
            if (fixed == null) throw new IllegalArgumentException("Enter the fixed salary");
            r.setFixedAmount(fixed);
            r.setSharePercent(null);
        } else {
            Double pct = positive(body.get("sharePercent"));
            if (pct == null || pct > 100) throw new IllegalArgumentException("Profit share must be between 1 and 100 %");
            r.setSharePercent(pct);
            r.setFixedAmount(null);
        }
        r.setAuditAmount(positive(body.get("auditAmount")));
        Object bankName = body.get("bankName");
        r.setBankName(bankName == null || bankName.toString().isBlank() ? null : bankName.toString().trim().toUpperCase());
        if (r.getAuditAmount() != null && r.getBankName() == null) {
            throw new IllegalArgumentException("Enter their name as it appears in the bank narration, so their salary transfers are not counted twice");
        }

        r.setUpdatedBy(currentUser());
        Map<String, Object> row = view(ruleRepository.save(r));
        row.put("staffName", staff.getName());
        return row;
    }

    @Transactional
    public void delete(Long staffId) {
        ruleRepository.findByStaffId(staffId).ifPresent(ruleRepository::delete);
    }

    // ------------------------------------------------------------------ advances

    /**
     * The employee's advance account up to `month` (YYYY-MM): every advance and repayment, the
     * month-by-month schedule, and totals - given, recovered (cuts plus repayments) and left.
     */
    public Map<String, Object> advances(Long staffId, String month) {
        YearMonth ym = YearMonth.parse(month);
        List<SalaryAdvance> entries = advanceRepository.findByStaffIdOrderByDateAscIdAsc(staffId);
        List<AdvanceSchedule.Month> rows = AdvanceSchedule.build(entries, ym);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("entries", entries.stream().map(SalaryRuleService::entryView).toList());
        out.put("schedule", rows.stream().map(r -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("month", r.month().toString());
            m.put("given", r.given());
            m.put("repaid", r.repaid());
            m.put("planned", r.planned());
            m.put("cut", r.cut());
            m.put("left", r.left());
            return m;
        }).toList());
        out.put("totals", totals(rows, ym));
        return out;
    }

    /**
     * Body: type GIVEN (date, amount, mode, note, and the cuts: either plan [{month, amount}] or
     * terms + startMonth for equal cuts) or REPAID (date, amount, mode, note).
     */
    @Transactional
    public Map<String, Object> addAdvance(Long staffId, Map<String, Object> body) {
        staffRepository.findById(staffId).orElseThrow(() -> new NoSuchElementException("Staff " + staffId + " not found"));
        String type = body.get("type") == null ? "" : body.get("type").toString().trim().toUpperCase();
        if (!type.equals("GIVEN") && !type.equals("REPAID")) throw new IllegalArgumentException("Choose advance given or repaid");
        SalaryAdvance a = new SalaryAdvance();
        a.setStaffId(staffId);
        a.setType(type);
        fill(a, body);
        a.setCreatedBy(currentUser());
        advanceRepository.save(a);
        return advances(staffId, YearMonth.from(a.getDate()).toString());
    }

    /** Change an advance or repayment: date, amount, mode, note and, for an advance, its monthly cuts. */
    @Transactional
    public Map<String, Object> updateAdvance(Long staffId, Long id, Map<String, Object> body) {
        SalaryAdvance a = advanceRepository.findById(id).filter(x -> x.getStaffId().equals(staffId))
            .orElseThrow(() -> new NoSuchElementException("Advance " + id + " not found"));
        fill(a, body);
        advanceRepository.save(a);
        return advances(staffId, YearMonth.from(a.getDate()).toString());
    }

    /** Checks the body and copies it onto the entry (its type stays as it is). */
    private void fill(SalaryAdvance a, Map<String, Object> body) {
        Double amount = positive(body.get("amount"));
        if (amount == null) throw new IllegalArgumentException("Enter the amount");
        LocalDate date;
        try {
            date = LocalDate.parse(String.valueOf(body.get("date")));
        } catch (RuntimeException ex) {
            throw new IllegalArgumentException("Choose the date");
        }
        String mode = body.get("mode") == null ? "CASH" : body.get("mode").toString().trim().toUpperCase();
        String note = body.get("note") == null || body.get("note").toString().isBlank() ? null : body.get("note").toString().trim();

        if ("GIVEN".equals(a.getType())) {
            TreeMap<YearMonth, Long> plan = readPlan(body, Math.round(amount), YearMonth.from(date));
            a.setCutPlan(AdvanceSchedule.planJson(plan));
            a.setStartMonth(plan.firstKey().toString());
            a.setTerms((int) ChronoUnit.MONTHS.between(plan.firstKey(), plan.lastKey()) + 1);
        } else {
            double owed = owedOn(a.getStaffId(), date, a.getId());
            if (amount > owed + 0.5) throw new IllegalArgumentException("That is more than is owed (" + Math.round(owed) + ")");
        }
        a.setDate(date);
        a.setAmount(amount);
        a.setMode(mode.equals("BANK") ? "BANK" : "CASH");
        a.setNote(note);
    }

    /**
     * The monthly cuts from the body: a plan [{month, amount}] that adds up to the advance, or
     * terms + startMonth for equal cuts. No cut before the month the advance was given.
     */
    static TreeMap<YearMonth, Long> readPlan(Map<String, Object> body, long amount, YearMonth given) {
        TreeMap<YearMonth, Long> plan = new TreeMap<>();
        if (body.get("plan") instanceof List<?> rows && !rows.isEmpty()) {
            for (Object o : rows) {
                if (!(o instanceof Map<?, ?> row)) throw new IllegalArgumentException("Each cut needs a month and an amount");
                YearMonth m;
                try {
                    m = YearMonth.parse(String.valueOf(row.get("month")));
                } catch (DateTimeParseException ex) {
                    throw new IllegalArgumentException("Choose the month of each cut");
                }
                double cut;
                try {
                    Object v = row.get("amount");
                    cut = v == null || v.toString().isBlank() ? 0 : Double.parseDouble(v.toString().trim());
                } catch (NumberFormatException ex) {
                    throw new IllegalArgumentException("Enter the cut for " + m);
                }
                if (cut < 0) throw new IllegalArgumentException("A cut cannot be negative (" + m + ")");
                if (plan.put(m, Math.round(cut)) != null) throw new IllegalArgumentException(m + " is in the plan twice");
            }
        } else {
            Double terms = positive(body.get("terms"));
            if (terms == null || terms != Math.floor(terms)) throw new IllegalArgumentException("Enter the months to cut it over");
            YearMonth start;
            try {
                start = YearMonth.parse(body.get("startMonth") == null ? "" : body.get("startMonth").toString().trim());
            } catch (DateTimeParseException ex) {
                throw new IllegalArgumentException("Choose the month the cuts start");
            }
            plan.putAll(AdvanceSchedule.equalPlan(amount, terms.intValue(), start));
        }
        // months with no cut at either end say nothing
        while (!plan.isEmpty() && plan.firstEntry().getValue() == 0) plan.pollFirstEntry();
        while (!plan.isEmpty() && plan.lastEntry().getValue() == 0) plan.pollLastEntry();
        if (plan.isEmpty()) throw new IllegalArgumentException("Plan at least one cut");
        if (plan.firstKey().isBefore(given)) throw new IllegalArgumentException("The cuts cannot start before the advance was given");
        long total = plan.values().stream().mapToLong(Long::longValue).sum();
        if (total != amount) {
            throw new IllegalArgumentException("The monthly cuts add up to " + total + ", not the advance of " + amount
                + (total < amount ? " (" + (amount - total) + " more to plan)" : " (" + (total - amount) + " too much)"));
        }
        return plan;
    }

    @Transactional
    public void deleteAdvance(Long staffId, Long id) {
        advanceRepository.findById(id).filter(a -> a.getStaffId().equals(staffId)).ifPresent(advanceRepository::delete);
    }

    /**
     * What is owed at the start of the month of `date`, after that month's advances and repayments
     * so far - leaving out the entry `skipId` (the one being changed), if any.
     */
    private double owedOn(Long staffId, LocalDate date, Long skipId) {
        YearMonth m = YearMonth.from(date);
        List<SalaryAdvance> entries = advanceRepository.findByStaffIdOrderByDateAscIdAsc(staffId).stream()
            .filter(e -> skipId == null || !skipId.equals(e.getId())).toList();
        AdvanceSchedule.Month row = AdvanceSchedule.at(AdvanceSchedule.build(entries, m), m);
        return row.left() + row.cut() + row.repaid(); // before this month's cut and repayments
    }

    /** Given, repaid and cut up to and including `upTo`, and what is left after it. */
    private static Map<String, Object> totals(List<AdvanceSchedule.Month> rows, YearMonth upTo) {
        long given = 0, repaid = 0, cut = 0, futureMonths = 0;
        for (AdvanceSchedule.Month r : rows) {
            if (!r.month().isAfter(upTo)) {
                given += r.given();
                repaid += r.repaid();
                cut += r.cut();
            } else if (r.cut() > 0) {
                futureMonths++;
            }
        }
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("upTo", upTo.toString());
        m.put("given", given);
        m.put("repaid", repaid);
        m.put("cut", cut);
        m.put("recovered", repaid + cut);
        m.put("left", AdvanceSchedule.at(rows, upTo).left());
        m.put("monthsLeft", futureMonths);
        return m;
    }

    private static Map<String, Object> entryView(SalaryAdvance a) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", a.getId());
        m.put("date", a.getDate());
        m.put("type", a.getType());
        m.put("amount", a.getAmount());
        m.put("terms", a.getTerms());
        m.put("startMonth", a.getStartMonth());
        m.put("mode", a.getMode());
        m.put("note", a.getNote());
        if ("GIVEN".equals(a.getType())) {
            Map<YearMonth, Long> plan = AdvanceSchedule.plan(a);
            m.put("plan", plan.entrySet().stream().map(p -> {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("month", p.getKey().toString());
                row.put("amount", p.getValue());
                return row;
            }).toList());
            // one monthly figure only when every cut but the last is the same
            List<Long> cuts = new ArrayList<>(plan.values());
            boolean equal = cuts.size() < 2 || cuts.subList(0, cuts.size() - 1).stream().distinct().count() == 1;
            m.put("monthlyCut", equal && !cuts.isEmpty() ? cuts.get(0) : null);
        }
        return m;
    }

    /**
     * Rules from before advances were a list kept one advance on the rule itself. Move each into the
     * list once (given in cash, dated the 1st of its first cut month) and clear it from the rule.
     */
    @Transactional
    public int moveRuleAdvancesToList() {
        int moved = 0;
        for (SalaryRule r : ruleRepository.findAll()) {
            if (r.getAdvanceAmount() == null || r.getAdvanceTerms() == null || r.getAdvanceStartMonth() == null) continue;
            if (!advanceRepository.existsByStaffId(r.getStaffId())) {
                SalaryAdvance a = new SalaryAdvance();
                a.setStaffId(r.getStaffId());
                a.setType("GIVEN");
                a.setDate(YearMonth.parse(r.getAdvanceStartMonth()).atDay(1));
                a.setAmount(r.getAdvanceAmount());
                a.setTerms(r.getAdvanceTerms());
                a.setStartMonth(r.getAdvanceStartMonth());
                a.setMode("CASH");
                a.setNote("Moved from the salary rule; change the date if it was given earlier");
                a.setCreatedBy(r.getUpdatedBy());
                advanceRepository.save(a);
                moved++;
            }
            r.setAdvanceAmount(null);
            r.setAdvanceTerms(null);
            r.setAdvanceStartMonth(null);
            ruleRepository.save(r);
        }
        return moved;
    }

    /**
     * Each rule worked out for the month (YYYY-MM). Dynamic rules share the dairy's profit: the
     * society's milk payments received in the bank that month minus the month's cattle expenses
     * in the ledger (unaccounted ones left out). A loss gives no share. The advance cut comes off either way.
     */
    public Map<String, Object> calculate(String month) {
        YearMonth ym = YearMonth.parse(month);
        double milkReceived = incomeService.getMilkReceivedByMonth().stream()
            .filter(m -> month.equals(m.get("month")))
            .mapToDouble(m -> ((Number) m.get("received")).doubleValue()).sum();
        double expenses = expenseRepository.findByDateBetween(ym.atDay(1), ym.atEndOfMonth()).stream()
            .filter(SalaryRuleService::countsForSalary)
            .mapToDouble(e -> e.getAmount() == null ? 0 : e.getAmount()).sum();
        double profit = Math.round(milkReceived) - Math.round(expenses);

        List<Map<String, Object>> rows = new ArrayList<>();
        for (Map<String, Object> rule : list()) {
            SalaryRule r = ruleRepository.findByStaffId((Long) rule.get("staffId")).orElseThrow();
            long earned = "FIXED".equals(r.getType())
                ? Math.round(r.getFixedAmount())
                : Math.round(Math.max(0, profit) * r.getSharePercent() / 100.0);
            List<AdvanceSchedule.Month> schedule =
                AdvanceSchedule.build(advanceRepository.findByStaffIdOrderByDateAscIdAsc(r.getStaffId()), ym);
            AdvanceSchedule.Month now = AdvanceSchedule.at(schedule, ym);
            Map<String, Object> row = new LinkedHashMap<>(rule);
            row.put("earned", earned);
            row.put("advanceCut", now.cut());
            row.put("advanceLeft", now.left());
            row.put("advance", totals(schedule, ym));
            row.put("payable", earned - now.cut());
            rows.add(row);
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("month", month);
        out.put("milkReceived", Math.round(milkReceived));
        out.put("expenses", Math.round(expenses));
        out.put("profit", Math.round(profit));
        out.put("rows", rows);
        return out;
    }

    /**
     * How one employee's salary comes out, month by month from `from` (YYYY-MM) to `to`, on the
     * farm's own records: milk sales booked in the app for the month minus the month's cattle
     * expenses in the ledger (unaccounted ones left out), times their share (or their fixed amount), less the advance cut.
     * A month's salary is paid early the next month, so it is set against the salary transfers
     * the bank shows in the following month, and the advance cut comes off that payment. The
     * month still running is shown as an estimate and left out of the totals.
     */
    public Map<String, Object> breakdown(Long staffId, String from, String to) {
        return breakdown(staffId, from, to, YearMonth.now());
    }

    Map<String, Object> breakdown(Long staffId, String from, String to, YearMonth today) {
        SalaryRule r = ruleRepository.findByStaffId(staffId)
            .orElseThrow(() -> new NoSuchElementException("No salary rule for staff " + staffId));
        Staff staff = staffRepository.findById(staffId)
            .orElseThrow(() -> new NoSuchElementException("Staff " + staffId + " not found"));
        YearMonth first = YearMonth.parse(from), last = YearMonth.parse(to);
        if (last.isBefore(first)) throw new IllegalArgumentException("The end month is before the start month");
        if (first.plusMonths(36).isBefore(last)) throw new IllegalArgumentException("Show at most three years at a time");

        LocalDate start = first.atDay(1), end = last.atEndOfMonth();
        Map<YearMonth, Double> milk = new LinkedHashMap<>(), expenses = new LinkedHashMap<>(), paid = new LinkedHashMap<>();
        Map<YearMonth, List<Map<String, Object>>> expenseLines = new LinkedHashMap<>();
        for (Income i : incomeRepository.findByDateBetween(start, end)) {
            if (i.getDate() != null && "MILK_SALES".equals(i.getCategory()) && i.getAmount() != null) {
                milk.merge(YearMonth.from(i.getDate()), i.getAmount(), Double::sum);
            }
        }
        for (Expense e : expenseRepository.findByDateBetween(start, end)) {
            if (e.getDate() != null && countsForSalary(e) && e.getAmount() != null) {
                expenses.merge(YearMonth.from(e.getDate()), e.getAmount(), Double::sum);
                Map<String, Object> line = new LinkedHashMap<>();
                line.put("id", e.getId());
                line.put("date", e.getDate().toString());
                line.put("category", e.getCategory());
                line.put("description", e.getDescription());
                line.put("amount", Math.round(e.getAmount()));
                line.put("paidBy", e.getPaidBy());
                expenseLines.computeIfAbsent(YearMonth.from(e.getDate()), k -> new ArrayList<>()).add(line);
            }
        }
        if (r.getBankName() != null) {
            // paid in the month after the one it is for
            LocalDate payStart = first.plusMonths(1).atDay(1), payEnd = last.plusMonths(1).atEndOfMonth();
            for (BankTransaction t : bankRepository.findByTxnDateBetweenOrderByTxnDateDescIdDesc(payStart, payEnd)) {
                if (isSalaryPaid(t, r.getBankName())) paid.merge(YearMonth.from(t.getTxnDate()).minusMonths(1), t.getAmount(), Double::sum);
            }
        }

        List<AdvanceSchedule.Month> schedule =
            AdvanceSchedule.build(advanceRepository.findByStaffIdOrderByDateAscIdAsc(staffId), last);
        boolean fixed = "FIXED".equals(r.getType());
        List<Map<String, Object>> months = new ArrayList<>();
        long totalEarned = 0, totalCut = 0, totalPayable = 0, totalPaid = 0;
        YearMonth lastFinished = null;
        for (YearMonth m = last; !m.isBefore(first); m = m.minusMonths(1)) {
            long milkSales = Math.round(milk.getOrDefault(m, 0.0));
            long cattle = Math.round(expenses.getOrDefault(m, 0.0));
            long profit = milkSales - cattle;
            long earned = fixed ? Math.round(r.getFixedAmount()) : Math.round(Math.max(0, profit) * r.getSharePercent() / 100.0);
            AdvanceSchedule.Month adv = AdvanceSchedule.at(schedule, m);
            long payable = earned - adv.cut();
            long bank = Math.round(paid.getOrDefault(m, 0.0));
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("month", m.toString());
            row.put("milkSales", milkSales);
            row.put("expenses", cattle);
            List<Map<String, Object>> lines = new ArrayList<>(expenseLines.getOrDefault(m, List.of()));
            lines.sort(Comparator.comparing((Map<String, Object> x) -> x.get("date").toString())
                .thenComparing(x -> x.get("id") == null ? 0L : (Long) x.get("id")));
            row.put("expenseLines", lines);
            row.put("profit", profit);
            row.put("earned", earned);
            row.put("advanceGiven", adv.given());
            row.put("advanceRepaid", adv.repaid());
            row.put("advanceCut", adv.cut());
            row.put("advanceLeft", adv.left());
            row.put("payable", payable);
            row.put("paidByBank", bank);
            row.put("balance", payable - bank);
            row.put("payMonth", m.plusMonths(1).toString());
            boolean running = !m.isBefore(today);
            row.put("current", running);
            months.add(row);
            if (running) continue; // not finished: an estimate, not owed yet
            if (lastFinished == null) lastFinished = m;
            totalEarned += earned;
            totalCut += adv.cut();
            totalPayable += payable;
            totalPaid += bank;
        }

        Map<String, Object> out = new LinkedHashMap<>(view(r));
        out.put("staffName", staff.getName());
        out.put("from", first.toString());
        out.put("to", last.toString());
        out.put("months", months);
        Map<String, Object> totals = new LinkedHashMap<>();
        totals.put("earned", totalEarned);
        totals.put("advanceCut", totalCut);
        totals.put("payable", totalPayable);
        totals.put("paidByBank", totalPaid);
        totals.put("balance", totalPayable - totalPaid);
        totals.put("upTo", lastFinished == null ? null : lastFinished.toString());
        totals.put("advanceLeft", AdvanceSchedule.at(schedule, lastFinished == null ? first.minusMonths(1) : lastFinished).left());
        out.put("totals", totals);
        return out;
    }

    /** A bank line booked as salary (money out, mapped, salary or wages) whose narration names them. */
    static boolean isSalaryPaid(BankTransaction t, String bankName) {
        if (!"MAPPED".equals(t.getStatus()) || !"DEBIT".equals(t.getDirection()) || !"EXPENSE".equals(t.getKind())) return false;
        if (t.getCategory() == null || !t.getCategory().toLowerCase(Locale.ROOT).matches(".*(salar|wage).*")) return false;
        return t.getTxnDate() != null && t.getAmount() != null && BankFeedService.matches(t.getNarration(), bankName);
    }

    /**
     * A cattle expense (same split the Digital Ledger uses: blank or CATTLE, and not the Poultry
     * category) that is not marked unaccounted; unaccounted ones are paid outside the shared books.
     */
    static boolean countsForSalary(Expense e) {
        return !e.isUnaccounted() && !"POULTRY".equals(e.getSegment()) && !"Poultry".equals(e.getCategory());
    }

    private Map<String, Object> view(SalaryRule r) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("staffId", r.getStaffId());
        m.put("type", r.getType());
        m.put("fixedAmount", r.getFixedAmount());
        m.put("sharePercent", r.getSharePercent());
        m.put("auditAmount", r.getAuditAmount());
        m.put("bankName", r.getBankName());
        return m;
    }

    private Map<Long, Staff> staffById() {
        return staffRepository.findAll().stream().collect(Collectors.toMap(Staff::getId, Function.identity()));
    }

    private static Double positive(Object o) {
        if (o == null || o.toString().isBlank()) return null;
        try {
            double d = Double.parseDouble(o.toString().trim());
            return d > 0 ? d : null;
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private static String currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth == null ? "system" : auth.getName();
    }
}
