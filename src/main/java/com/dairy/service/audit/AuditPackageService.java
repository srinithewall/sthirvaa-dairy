package com.dairy.service.audit;

import com.dairy.model.Expense;
import com.dairy.model.audit.AuditPackage;
import com.dairy.model.audit.AuditPackageAttachment;
import com.dairy.model.audit.AuditPackageExpense;
import com.dairy.model.bank.BankStatementFile;
import com.dairy.model.bank.BankTransaction;
import com.dairy.repo.ExpenseRepository;
import com.dairy.repo.audit.AuditPackageAttachmentRepository;
import com.dairy.repo.audit.AuditPackageExpenseRepository;
import com.dairy.repo.audit.AuditPackageRepository;
import com.dairy.repo.bank.BankStatementFileRepository;
import com.dairy.repo.bank.BankTransactionRepository;
import com.dairy.repo.bank.SalaryRuleRepository;
import com.dairy.repo.StaffRepository;
import com.dairy.model.Staff;
import com.dairy.model.bank.SalaryRule;
import com.dairy.service.bank.BankFeedService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Builds a month's auditor package from the farm's books (the feed shop is not part of it).
 *
 * Purchases are the bank payments booked as expenses plus the month's cash expenses: Digital
 * Ledger expenses that no bank line paid. Those are copied into the package when it is created
 * and whenever someone asks to check the ledger again; after that the package's own list is what
 * counts, so lines can be removed or added without touching the ledger.
 */
@Service
public class AuditPackageService {

    static final String DEFAULT_GST_NOTE = "Not applicable: the farm's sales are raw milk and farm produce, which "
        + "are exempt from GST, and no GST-rated supplies were recorded this month.";

    @Autowired private AuditPackageRepository packageRepository;
    @Autowired private AuditPackageExpenseRepository expenseLineRepository;
    @Autowired private AuditPackageAttachmentRepository attachmentRepository;
    @Autowired private ExpenseRepository expenseRepository;
    @Autowired private BankTransactionRepository bankRepository;
    @Autowired private BankStatementFileRepository statementRepository;
    @Autowired private SalaryRuleRepository salaryRuleRepository;
    @Autowired private StaffRepository staffRepository;

    public List<Map<String, Object>> list() {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Object[] r : packageRepository.listSummaries()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", r[0]);
            m.put("periodFrom", r[1]);
            m.put("periodTo", r[2]);
            m.put("documentSavedAt", r[3]);
            m.put("updatedAt", r[4]);
            out.add(m);
        }
        return out;
    }

    /** The month's package, created with its cash expenses the first time it is opened. */
    @Transactional
    public Map<String, Object> open(YearMonth month) {
        AuditPackage p = packageRepository.findByPeriodFrom(month.atDay(1)).orElseGet(() -> {
            AuditPackage n = new AuditPackage();
            n.setPeriodFrom(month.atDay(1));
            n.setPeriodTo(month.atEndOfMonth());
            n.setGstNote(DEFAULT_GST_NOTE);
            n.setCreatedAt(LocalDateTime.now());
            n.setCreatedBy(currentUser());
            touch(n);
            AuditPackage saved = packageRepository.save(n);
            addNewCashExpenses(saved);
            return saved;
        });
        return view(p);
    }

    public Map<String, Object> view(Long id) {
        return view(get(id));
    }

    @Transactional
    public Map<String, Object> update(Long id, Map<String, Object> body) {
        AuditPackage p = get(id);
        if (body.containsKey("includeGst")) p.setIncludeGst(Boolean.TRUE.equals(body.get("includeGst")));
        if (body.containsKey("gstNote")) p.setGstNote(trim(body.get("gstNote"), 1000));
        if (body.containsKey("notes")) p.setNotes(trim(body.get("notes"), 2000));
        touch(p);
        packageRepository.save(p);
        return view(p);
    }

    /** Checks the ledger again: new cash expenses are added; lines a bank payment now covers are taken out. */
    @Transactional
    public Map<String, Object> refresh(Long id) {
        AuditPackage p = get(id);
        Set<Long> bankPaid = bankRepository.findLedgerIdsByKind("EXPENSE");
        for (AuditPackageExpense line : expenseLineRepository.findByPackageIdOrderByDateAscIdAsc(id)) {
            if (line.getLedgerExpenseId() != null && !line.isExcluded() && bankPaid.contains(line.getLedgerExpenseId())) {
                line.setExcluded(true);
                expenseLineRepository.save(line);
            }
        }
        addNewCashExpenses(p);
        touch(p);
        packageRepository.save(p);
        return view(p);
    }

    /** Adds a ledger expense (body.ledgerExpenseId) or a typed-in one (date, category, description, amount, paidBy). */
    @Transactional
    public Map<String, Object> addExpense(Long id, Map<String, Object> body) {
        AuditPackage p = get(id);
        AuditPackageExpense line;
        Object ledgerId = body.get("ledgerExpenseId");
        if (ledgerId != null) {
            Long eid = Long.valueOf(ledgerId.toString());
            Optional<AuditPackageExpense> existing = expenseLineRepository.findByPackageIdOrderByDateAscIdAsc(id).stream()
                .filter(l -> eid.equals(l.getLedgerExpenseId())).findFirst();
            if (existing.isPresent()) {
                line = existing.get();
                line.setExcluded(false);
            } else {
                Expense e = expenseRepository.findById(eid)
                    .orElseThrow(() -> new NoSuchElementException("Ledger expense " + eid + " not found"));
                line = fromLedger(p.getId(), e);
            }
        } else {
            line = new AuditPackageExpense();
            line.setPackageId(p.getId());
            line.setDate(LocalDate.parse(String.valueOf(body.get("date"))));
            line.setCategory(trim(body.get("category"), 100));
            line.setDescription(trim(body.get("description"), 255));
            line.setPaidBy(trim(body.get("paidBy"), 100));
            Object amount = body.get("amount");
            if (amount == null || Double.parseDouble(amount.toString()) <= 0) {
                throw new IllegalArgumentException("Enter an amount");
            }
            line.setAmount(Double.parseDouble(amount.toString()));
            if (line.getDate().isBefore(p.getPeriodFrom()) || line.getDate().isAfter(p.getPeriodTo())) {
                throw new IllegalArgumentException("The date must be within " + p.getPeriodFrom() + " to " + p.getPeriodTo());
            }
        }
        expenseLineRepository.save(line);
        touch(p);
        packageRepository.save(p);
        return view(p);
    }

    /**
     * Changes a manual line. Body may hold: excluded (remove or put back; typed-in lines are deleted
     * outright), reviewed, and date / category / description / amount / paidBy to correct it. Edits
     * stay in the package; the Digital Ledger entry it was copied from is not touched.
     */
    @Transactional
    public Map<String, Object> updateExpense(Long id, Long lineId, Map<String, Object> body) {
        AuditPackage p = get(id);
        AuditPackageExpense line = expenseLineRepository.findById(lineId)
            .filter(l -> l.getPackageId().equals(id))
            .orElseThrow(() -> new NoSuchElementException("Expense line " + lineId + " not found"));
        if (Boolean.TRUE.equals(body.get("excluded")) && line.getLedgerExpenseId() == null) {
            expenseLineRepository.delete(line);
            touch(p);
            packageRepository.save(p);
            return view(p);
        }
        if (body.containsKey("excluded")) line.setExcluded(Boolean.TRUE.equals(body.get("excluded")));
        if (body.containsKey("reviewed")) {
            line.setReviewed(Boolean.TRUE.equals(body.get("reviewed")));
            line.setReviewedBy(line.isReviewed() ? currentUser() : null);
        }
        boolean edited = false;
        if (body.containsKey("date")) {
            LocalDate d = LocalDate.parse(String.valueOf(body.get("date")));
            if (d.isBefore(p.getPeriodFrom()) || d.isAfter(p.getPeriodTo())) {
                throw new IllegalArgumentException("The date must be within " + p.getPeriodFrom() + " to " + p.getPeriodTo());
            }
            line.setDate(d);
            edited = true;
        }
        if (body.containsKey("amount")) {
            double amount = Double.parseDouble(String.valueOf(body.get("amount")));
            if (amount <= 0) throw new IllegalArgumentException("Enter an amount");
            line.setAmount(amount);
            edited = true;
        }
        if (body.containsKey("category")) { line.setCategory(trim(body.get("category"), 100)); edited = true; }
        if (body.containsKey("description")) { line.setDescription(trim(body.get("description"), 255)); edited = true; }
        if (body.containsKey("paidBy")) { line.setPaidBy(trim(body.get("paidBy"), 100)); edited = true; }
        if (edited) {
            line.setEdited(true);
            line.setReviewed(true); // correcting a line is reviewing it
            line.setReviewedBy(currentUser());
        }
        expenseLineRepository.save(line);
        touch(p);
        packageRepository.save(p);
        return view(p);
    }

    @Transactional
    public Map<String, Object> addAttachment(Long id, byte[] bytes, String fileName, String contentType) {
        AuditPackage p = get(id);
        String type = contentType == null ? "" : contentType.toLowerCase(Locale.ROOT);
        String name = fileName == null ? "invoice" : fileName;
        if (!type.equals("application/pdf") && !type.equals("image/jpeg") && !type.equals("image/png")) {
            throw new IllegalArgumentException("Invoices must be PDF, JPG or PNG");
        }
        AuditPackageAttachment a = new AuditPackageAttachment();
        a.setPackageId(p.getId());
        a.setFileName(trim(name, 200));
        a.setContentType(type);
        a.setSizeBytes(bytes.length);
        a.setContent(bytes);
        a.setUploadedAt(LocalDateTime.now());
        a.setUploadedBy(currentUser());
        attachmentRepository.save(a);
        touch(p);
        packageRepository.save(p);
        return view(p);
    }

    @Transactional
    public Map<String, Object> setAttachmentIncluded(Long id, Long attachmentId, boolean included) {
        AuditPackageAttachment a = attachment(id, attachmentId);
        a.setIncluded(included);
        attachmentRepository.save(a);
        return view(get(id));
    }

    @Transactional
    public Map<String, Object> deleteAttachment(Long id, Long attachmentId) {
        attachmentRepository.delete(attachment(id, attachmentId));
        return view(get(id));
    }

    public AuditPackageAttachment attachment(Long id, Long attachmentId) {
        return attachmentRepository.findById(attachmentId)
            .filter(a -> a.getPackageId().equals(id))
            .orElseThrow(() -> new NoSuchElementException("Attachment " + attachmentId + " not found"));
    }

    /** Kotak's statement for this package's month (Annexure A). */
    public BankStatementFile statement(Long id, Long statementId) {
        AuditPackage p = get(id);
        return statementRepository.findById(statementId)
            .filter(s -> !s.getPeriodTo().isBefore(p.getPeriodFrom()) && !s.getPeriodFrom().isAfter(p.getPeriodTo()))
            .orElseThrow(() -> new NoSuchElementException("No statement " + statementId + " for this month"));
    }

    @Transactional
    public Map<String, Object> saveDocument(Long id, byte[] pdf) {
        AuditPackage p = get(id);
        p.setDocument(pdf);
        p.setDocumentSavedAt(LocalDateTime.now());
        p.setDocumentSavedBy(currentUser());
        packageRepository.save(p);
        return Map.of("documentSavedAt", p.getDocumentSavedAt());
    }

    public AuditPackage get(Long id) {
        return packageRepository.findById(id).orElseThrow(() -> new NoSuchElementException("Package " + id + " not found"));
    }

    // ------------------------------------------------------------------ cash expenses

    /** Ledger expenses of the month no bank line paid and not already in the package (even removed). */
    private void addNewCashExpenses(AuditPackage p) {
        Set<Long> inPackage = expenseLineRepository.findByPackageIdOrderByDateAscIdAsc(p.getId()).stream()
            .map(AuditPackageExpense::getLedgerExpenseId).filter(Objects::nonNull).collect(Collectors.toSet());
        Set<Long> bankPaid = bankRepository.findLedgerIdsByKind("EXPENSE");
        for (Expense e : expenseRepository.findByDateBetween(p.getPeriodFrom(), p.getPeriodTo())) {
            if (inPackage.contains(e.getId()) || bankPaid.contains(e.getId())) continue;
            expenseLineRepository.save(fromLedger(p.getId(), e));
        }
    }

    private static AuditPackageExpense fromLedger(Long packageId, Expense e) {
        AuditPackageExpense line = new AuditPackageExpense();
        line.setPackageId(packageId);
        line.setLedgerExpenseId(e.getId());
        line.setDate(e.getDate());
        line.setCategory(e.getCategory());
        line.setDescription(e.getDescription());
        line.setAmount(e.getAmount());
        line.setPaidBy(e.getPaidBy());
        line.setSegment(e.getSegment());
        return line;
    }

    // ------------------------------------------------------------------ the sections

    Map<String, Object> view(AuditPackage p) {
        LocalDate from = p.getPeriodFrom(), to = p.getPeriodTo();
        Map<String, Object> out = new LinkedHashMap<>();

        Map<String, Object> pkg = new LinkedHashMap<>();
        pkg.put("id", p.getId());
        pkg.put("periodFrom", from);
        pkg.put("periodTo", to);
        pkg.put("includeGst", p.isIncludeGst());
        pkg.put("gstNote", p.getGstNote());
        pkg.put("notes", p.getNotes());
        pkg.put("documentSavedAt", p.getDocumentSavedAt());
        pkg.put("documentSavedBy", p.getDocumentSavedBy());
        pkg.put("updatedAt", p.getUpdatedAt());
        pkg.put("updatedBy", p.getUpdatedBy());
        out.put("package", pkg);

        // Cash expenses, and the month's other ledger expenses that could be added
        Set<Long> bankPaid = bankRepository.findLedgerIdsByKind("EXPENSE");
        List<AuditPackageExpense> lines = expenseLineRepository.findByPackageIdOrderByDateAscIdAsc(p.getId());
        List<Map<String, Object>> cash = new ArrayList<>();
        for (AuditPackageExpense l : lines) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", l.getId());
            m.put("ledgerExpenseId", l.getLedgerExpenseId());
            m.put("date", l.getDate());
            m.put("category", l.getCategory());
            m.put("description", l.getDescription());
            m.put("amount", l.getAmount());
            m.put("paidBy", l.getPaidBy());
            m.put("excluded", l.isExcluded());
            m.put("reviewed", l.isReviewed());
            m.put("reviewedBy", l.getReviewedBy());
            m.put("edited", l.isEdited());
            m.put("paidThroughBank", l.getLedgerExpenseId() != null && bankPaid.contains(l.getLedgerExpenseId()));
            cash.add(m);
        }
        out.put("cashExpenses", cash);
        Set<Long> inPackage = lines.stream().map(AuditPackageExpense::getLedgerExpenseId)
            .filter(Objects::nonNull).collect(Collectors.toSet());
        out.put("ledgerExpenses", expenseRepository.findByDateBetween(from, to).stream()
            .filter(e -> !inPackage.contains(e.getId()))
            .sorted(Comparator.comparing(Expense::getDate))
            .map(e -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("id", e.getId());
                m.put("date", e.getDate());
                m.put("category", e.getCategory());
                m.put("description", e.getDescription());
                m.put("amount", e.getAmount());
                m.put("paidBy", e.getPaidBy());
                m.put("paidThroughBank", bankPaid.contains(e.getId()));
                return m;
            }).toList());

        List<Map<String, Object>> salaries = auditSalaries();
        out.put("salaries", salaries);
        out.put("bank", bankSection(from, to, salaries));
        out.put("sales", salesSection(from, to));

        out.put("statements", statementRepository
            .findByPeriodToGreaterThanEqualAndPeriodFromLessThanEqualOrderByPeriodFromAsc(from, to).stream()
            .map(s -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("id", s.getId());
                m.put("periodFrom", s.getPeriodFrom());
                m.put("periodTo", s.getPeriodTo());
                m.put("accountLast4", s.getAccountLast4());
                m.put("pages", s.getPages());
                return m;
            }).toList());

        out.put("attachments", attachmentRepository.listMeta(p.getId()).stream().map(r -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", r[0]);
            m.put("fileName", r[1]);
            m.put("contentType", r[2]);
            m.put("sizeBytes", r[3]);
            m.put("included", r[4]);
            m.put("uploadedAt", r[5]);
            return m;
        }).toList());
        return out;
    }

    /** The month's bank lines: balances for the reconciliation, and how each line was booked. */
    /**
     * Employees whose salary rule sets a salary for the audit report: name, amount, and the words
     * that pick out their bank lines.
     */
    private List<Map<String, Object>> auditSalaries() {
        Map<Long, String> names = new HashMap<>();
        for (Staff s : staffRepository.findAll()) names.put(s.getId(), s.getName());
        List<Map<String, Object>> out = new ArrayList<>();
        for (SalaryRule r : salaryRuleRepository.findAll()) {
            if (r.getAuditAmount() == null || r.getAuditAmount() <= 0) continue;
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("staffId", r.getStaffId());
            m.put("name", names.getOrDefault(r.getStaffId(), "Employee " + r.getStaffId()));
            m.put("amount", r.getAuditAmount());
            m.put("bankName", r.getBankName());
            out.add(m);
        }
        out.sort(Comparator.comparing(m -> m.get("name").toString()));
        return out;
    }

    /** A bank line typed Salary that pays one of the audit salaries: in the register as that fixed salary instead. */
    private static String salaryPaymentFor(BankTransaction t, List<Map<String, Object>> salaries) {
        if (!"MAPPED".equals(t.getStatus()) || !"DEBIT".equals(t.getDirection()) || !"EXPENSE".equals(t.getKind())) return null;
        if (t.getCategory() == null || !t.getCategory().toLowerCase(Locale.ROOT).matches(".*(salar|wage).*")) return null;
        for (Map<String, Object> s : salaries) {
            Object words = s.get("bankName");
            if (words != null && BankFeedService.matches(t.getNarration(), words.toString())) return s.get("name").toString();
        }
        return null;
    }

    private Map<String, Object> bankSection(LocalDate from, LocalDate to, List<Map<String, Object>> salaries) {
        List<BankTransaction> txns = new ArrayList<>(bankRepository.findByTxnDateBetweenOrderByTxnDateDescIdDesc(from, to));
        txns.sort(Comparator.comparing(BankTransaction::getTxnDate).thenComparing(BankTransaction::getId));
        Map<String, Object> out = new LinkedHashMap<>();
        double receipts = 0, payments = 0;
        for (BankTransaction t : txns) {
            if ("CREDIT".equals(t.getDirection())) receipts += t.getAmount(); else payments += t.getAmount();
        }
        Double opening = null, closing = null;
        if (!txns.isEmpty()) {
            BankTransaction first = txns.get(0), last = txns.get(txns.size() - 1);
            if (first.getBalance() != null) {
                opening = first.getBalance() - ("CREDIT".equals(first.getDirection()) ? first.getAmount() : -first.getAmount());
            }
            closing = last.getBalance();
        }
        out.put("accountLast4", txns.stream().map(BankTransaction::getAccountLast4).filter(Objects::nonNull).findFirst().orElse(null));
        out.put("openingBalance", opening);
        out.put("receipts", receipts);
        out.put("payments", payments);
        out.put("closingBalance", closing);
        out.put("lines", txns.stream().map(t -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", t.getId());
            m.put("date", t.getTxnDate());
            m.put("narration", t.getNarration());
            m.put("counterparty", t.getCounterparty());
            m.put("direction", t.getDirection());
            m.put("amount", t.getAmount());
            m.put("status", t.getStatus());
            m.put("kind", t.getKind());
            m.put("category", t.getCategory());
            m.put("note", t.getNote());
            m.put("salaryOf", salaryPaymentFor(t, salaries));
            return m;
        }).toList());
        return out;
    }

    /**
     * Sales are what reached the bank: money in booked as Sold (milk) or other income. The app's
     * own daily milk records are estimates and are not used here. Money in not yet reviewed is
     * counted separately so the gap is visible.
     */
    private Map<String, Object> salesSection(LocalDate from, LocalDate to) {
        Map<String, double[]> byCategory = new TreeMap<>();
        List<Map<String, Object>> receipts = new ArrayList<>();
        double pending = 0;
        int pendingCount = 0;
        List<BankTransaction> txns = new ArrayList<>(bankRepository.findByTxnDateBetweenOrderByTxnDateDescIdDesc(from, to));
        txns.sort(Comparator.comparing(BankTransaction::getTxnDate).thenComparing(BankTransaction::getId));
        for (BankTransaction t : txns) {
            if (!"CREDIT".equals(t.getDirection())) continue;
            if ("UNMAPPED".equals(t.getStatus()) || "SUGGESTED".equals(t.getStatus())) {
                pending += t.getAmount();
                pendingCount++;
                continue;
            }
            if (!"MAPPED".equals(t.getStatus())) continue; // ignored: own transfers, reversals
            String category = t.getCategory() == null ? "Uncategorised" : t.getCategory();
            double[] g = byCategory.computeIfAbsent(category, k -> new double[2]);
            g[0] += 1;
            g[1] += t.getAmount();
            Map<String, Object> r = new LinkedHashMap<>();
            r.put("date", t.getTxnDate());
            r.put("party", t.getCounterparty());
            r.put("narration", t.getNarration());
            r.put("category", category);
            r.put("amount", t.getAmount());
            r.put("note", t.getNote());
            receipts.add(r);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("byCategory", byCategory.entrySet().stream().map(e -> Map.<String, Object>of(
            "category", e.getKey(), "count", (int) e.getValue()[0], "amount", e.getValue()[1])).toList());
        out.put("receipts", receipts);
        out.put("unreviewedCount", pendingCount);
        out.put("unreviewedAmount", pending);
        return out;
    }

    private void touch(AuditPackage p) {
        p.setUpdatedAt(LocalDateTime.now());
        p.setUpdatedBy(currentUser());
    }

    private static String trim(Object o, int max) {
        if (o == null) return null;
        String s = o.toString().trim();
        if (s.isEmpty()) return null;
        return s.length() <= max ? s : s.substring(0, max);
    }

    private static String currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth == null ? "system" : auth.getName();
    }
}
