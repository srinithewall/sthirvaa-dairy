package com.dairy.controller;

import com.dairy.model.Expense;
import com.dairy.model.ExpenseAttachment;
import com.dairy.repo.ExpenseAttachmentRepository;
import org.springframework.http.MediaType;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
import com.dairy.service.ExpenseService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/expenses")
public class ExpenseController {

    @Autowired
    private ExpenseService expenseService;

    @GetMapping
    public List<Expense> getAllExpenses() {
        return expenseService.getAllExpenses();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Expense> getExpenseById(@PathVariable Long id) {
        return expenseService.getExpenseById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    @PreAuthorize("@ss.can('LEDGER', 'CREATE')")
    public Expense createExpense(@RequestBody Expense expense) {
        return expenseService.saveExpense(expense);
    }

    @PutMapping("/{id}")
    @PreAuthorize("@ss.can('LEDGER', 'EDIT')")
    public ResponseEntity<Expense> updateExpense(@PathVariable Long id, @RequestBody Expense expense) {
        return expenseService.getExpenseById(id)
                .map(existing -> {
                    expense.setId(id);
                    return ResponseEntity.ok(expenseService.saveExpense(expense));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("@ss.can('LEDGER', 'DELETE')")
    public ResponseEntity<Void> deleteExpense(@PathVariable Long id) {
        expenseService.deleteExpense(id);
        return ResponseEntity.noContent().build();
    }

    // ── Bills and receipts kept with an expense ──

    @GetMapping("/{id}/attachments")
    public List<ExpenseAttachmentRepository.Info> getAttachments(@PathVariable Long id) {
        return expenseService.getAttachments(id);
    }

    @PostMapping(value = "/{id}/attachments", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("@ss.can('LEDGER', 'CREATE') or @ss.can('LEDGER', 'EDIT')")
    public List<ExpenseAttachmentRepository.Info> addAttachment(@PathVariable Long id,
                                                                @RequestParam("file") MultipartFile file) throws IOException {
        return expenseService.addAttachment(id, file.getBytes(), file.getOriginalFilename(), file.getContentType());
    }

    @GetMapping("/{id}/attachments/{attachmentId}/file")
    public ResponseEntity<byte[]> attachmentFile(@PathVariable Long id, @PathVariable Long attachmentId) {
        ExpenseAttachment a = expenseService.getAttachment(id, attachmentId);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(a.getContentType()))
                .header("Content-Disposition", "inline; filename=\"" + a.getFileName().replace("\"", "") + "\"")
                .body(a.getContent());
    }

    @DeleteMapping("/{id}/attachments/{attachmentId}")
    @PreAuthorize("@ss.can('LEDGER', 'EDIT') or @ss.can('LEDGER', 'DELETE')")
    public List<ExpenseAttachmentRepository.Info> deleteAttachment(@PathVariable Long id, @PathVariable Long attachmentId) {
        return expenseService.deleteAttachment(id, attachmentId);
    }

    @GetMapping("/range")
    public List<Expense> getExpensesByRange(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate start,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate end) {
        return expenseService.getExpensesByDateRange(start, end);
    }

    @PatchMapping("/settle")
    @PreAuthorize("@ss.can('LEDGER', 'EDIT')")
    public List<Expense> settleExpenses(
            @RequestParam String paidBy,
            @RequestParam(required = false) String month) {
        return expenseService.settleExpensesForStaff(paidBy, month);
    }
}
