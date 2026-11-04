package com.dairy.controller;

import com.dairy.model.bank.BankRule;
import com.dairy.model.bank.BankStatementFile;
import com.dairy.model.bank.BankTransaction;
import com.dairy.service.bank.BankFeedService;
import com.dairy.service.bank.BankStatementService;
import com.dairy.service.bank.SalaryRuleService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * The Kotak current account feed: fetch the statement, review how each line was mapped to the
 * books, and teach rules. Access follows the BANK row of role_permissions (by default ADMIN,
 * PARTNER and FINANCE; staff have none).
 */
@RestController
@RequestMapping("/api/bank")
public class BankController {
    private static final String VIEW = "@ss.can('BANK', 'VIEW')";
    private static final String CREATE = "@ss.can('BANK', 'CREATE')";
    private static final String EDIT = "@ss.can('BANK', 'EDIT')";
    private static final String DELETE = "@ss.can('BANK', 'DELETE')";

    @Autowired
    private BankFeedService bankFeedService;

    @Autowired
    private BankStatementService bankStatementService;

    @Autowired
    private SalaryRuleService salaryRuleService;

    @PreAuthorize(VIEW)
    @GetMapping("/status")
    public Map<String, Object> status() {
        return bankFeedService.status();
    }

    /** Without dates: everything new since the last fetch. */
    @PreAuthorize(CREATE)
    @PostMapping("/fetch")
    public Map<String, Object> fetch(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return bankFeedService.fetch(from, to);
    }

    /**
     * A statement downloaded from Kotak net banking. CSV: its lines are filed and mapped like a fetch.
     * PDF: kept as the period's official statement, attached to the downloaded report.
     */
    @PreAuthorize(CREATE)
    @PostMapping(value = "/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, Object> importStatement(@RequestParam("file") MultipartFile file) throws IOException {
        String name = file.getOriginalFilename() == null ? "" : file.getOriginalFilename();
        if (name.toLowerCase().endsWith(".pdf") || "application/pdf".equals(file.getContentType())) {
            BankStatementFile stored = bankStatementService.store(file.getBytes(), name);
            return Map.of("statement", Map.of("id", stored.getId(), "periodFrom", stored.getPeriodFrom(),
                "periodTo", stored.getPeriodTo(), "pages", stored.getPages()));
        }
        return bankFeedService.importFile(file.getBytes(), name);
    }

    /** PDF statements on file for any day of from..to. */
    @PreAuthorize(VIEW)
    @GetMapping("/statements")
    public List<Map<String, Object>> statements(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return bankStatementService.list(from, to);
    }

    @PreAuthorize(VIEW)
    @GetMapping("/statements/{id}/file")
    public ResponseEntity<byte[]> statementFile(@PathVariable Long id) {
        BankStatementFile f = bankStatementService.get(id);
        return ResponseEntity.ok()
            .contentType(MediaType.APPLICATION_PDF)
            .header("Content-Disposition", "inline; filename=\"kotak-statement-" + f.getPeriodFrom() + ".pdf\"")
            .body(f.getContent());
    }

    @PreAuthorize(DELETE)
    @DeleteMapping("/statements/{id}")
    public ResponseEntity<Void> deleteStatement(@PathVariable Long id) {
        bankStatementService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PreAuthorize(VIEW)
    @GetMapping("/transactions")
    public List<BankTransaction> transactions(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return bankFeedService.list(from, to);
    }

    /** Body: kind (EXPENSE, INCOME, SETTLEMENT, IGNORE), category, segment, note, remember, pattern. */
    @PreAuthorize(EDIT)
    @PutMapping("/transactions/{id}")
    public Map<String, Object> assign(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        return bankFeedService.assign(id,
            str(body.get("kind")), str(body.get("category")), str(body.get("segment")), str(body.get("note")),
            Boolean.TRUE.equals(body.get("remember")), str(body.get("pattern")));
    }

    @PreAuthorize(EDIT)
    @PostMapping("/transactions/{id}/reset")
    public BankTransaction reset(@PathVariable Long id) {
        return bankFeedService.reset(id);
    }

    @PreAuthorize(EDIT)
    @PostMapping("/transactions/approve")
    public Map<String, Object> approve(@RequestBody List<Long> ids) {
        return Map.of("approved", bankFeedService.approve(ids));
    }

    @PreAuthorize(VIEW)
    @GetMapping("/rules")
    public List<BankRule> rules() {
        return bankFeedService.rules();
    }

    /** Body: pattern, direction (CREDIT, DEBIT, ANY), kind (EXPENSE, INCOME, SETTLEMENT, IGNORE, EMPLOYEE), category, segment. */
    @PreAuthorize(CREATE)
    @PostMapping("/rules")
    public Map<String, Object> createRule(@RequestBody Map<String, Object> body) {
        return bankFeedService.createRule(str(body.get("pattern")), str(body.get("direction")), str(body.get("kind")),
            str(body.get("category")), str(body.get("segment")));
    }

    /** The rules built into the app, in the order they are tried. Read-only. */
    @PreAuthorize(VIEW)
    @GetMapping("/rules/built-in")
    public List<Map<String, Object>> builtInRules() {
        return bankFeedService.builtInRules();
    }

    @PreAuthorize(DELETE)
    @DeleteMapping("/rules/{id}")
    public ResponseEntity<Void> deleteRule(@PathVariable Long id) {
        bankFeedService.deleteRule(id);
        return ResponseEntity.noContent().build();
    }

    /** Salary rules: {rules: [...], staff: [{id, name, salary}]}. */
    @PreAuthorize(VIEW)
    @GetMapping("/salary-rules")
    public Map<String, Object> salaryRules() {
        return Map.of("rules", salaryRuleService.list(), "staff", salaryRuleService.staff());
    }

    /** Body: type (FIXED, DYNAMIC), fixedAmount or sharePercent. Advances are kept under /advances. */
    @PreAuthorize(EDIT)
    @PutMapping("/salary-rules/{staffId}")
    public Map<String, Object> saveSalaryRule(@PathVariable Long staffId, @RequestBody Map<String, Object> body) {
        return salaryRuleService.save(staffId, body);
    }

    @PreAuthorize(DELETE)
    @DeleteMapping("/salary-rules/{staffId}")
    public ResponseEntity<Void> deleteSalaryRule(@PathVariable Long staffId) {
        salaryRuleService.delete(staffId);
        return ResponseEntity.noContent().build();
    }

    /** The employee's advance account up to the month (YYYY-MM): entries, schedule, given / recovered / left. */
    @PreAuthorize(VIEW)
    @GetMapping("/salary-rules/{staffId}/advances")
    public Map<String, Object> advances(@PathVariable Long staffId, @RequestParam String month) {
        return salaryRuleService.advances(staffId, month);
    }

    /** Body: type GIVEN (date, amount, terms, startMonth, mode, note) or REPAID (date, amount, mode, note). */
    @PreAuthorize(EDIT)
    @PostMapping("/salary-rules/{staffId}/advances")
    public Map<String, Object> addAdvance(@PathVariable Long staffId, @RequestBody Map<String, Object> body) {
        return salaryRuleService.addAdvance(staffId, body);
    }

    /** Change an advance or repayment. Body as for adding; an advance takes plan [{month, amount}]. */
    @PreAuthorize(EDIT)
    @PutMapping("/salary-rules/{staffId}/advances/{id}")
    public Map<String, Object> updateAdvance(@PathVariable Long staffId, @PathVariable Long id, @RequestBody Map<String, Object> body) {
        return salaryRuleService.updateAdvance(staffId, id, body);
    }

    @PreAuthorize(DELETE)
    @DeleteMapping("/salary-rules/{staffId}/advances/{id}")
    public ResponseEntity<Void> deleteAdvance(@PathVariable Long staffId, @PathVariable Long id) {
        salaryRuleService.deleteAdvance(staffId, id);
        return ResponseEntity.noContent().build();
    }

    /**
     * One employee's salary month by month, from `from` (YYYY-MM) to `to` (default this month), on
     * the farm's records: milk sales minus cattle expenses, their share, the advance cut, and what
     * the bank shows was paid.
     */
    @PreAuthorize(VIEW)
    @GetMapping("/salary-rules/{staffId}/breakdown")
    public Map<String, Object> salaryBreakdown(@PathVariable Long staffId, @RequestParam String from,
                                               @RequestParam(required = false) String to) {
        String end = to == null || to.isBlank() ? java.time.YearMonth.now().toString() : to;
        return salaryRuleService.breakdown(staffId, from, end);
    }

    /** Each rule worked out for the month (YYYY-MM): profit share or fixed salary, less the advance cut. */
    @PreAuthorize(VIEW)
    @GetMapping("/salary-rules/calculate")
    public Map<String, Object> calculateSalaries(@RequestParam String month) {
        return salaryRuleService.calculate(month);
    }

    private static String str(Object o) {
        return o == null ? null : o.toString();
    }
}
