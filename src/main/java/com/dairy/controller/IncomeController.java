package com.dairy.controller;

import com.dairy.model.Income;
import com.dairy.service.IncomeService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/income")
public class IncomeController {

    @Autowired
    private IncomeService incomeService;

    @GetMapping
    public List<Income> getAllIncome() {
        return incomeService.getAllIncome();
    }

    /** Society milk payments credited to the bank, per month: [{month, received, pending, payments}]. */
    @GetMapping("/milk-received")
    public List<Map<String, Object>> getMilkReceived() {
        return incomeService.getMilkReceivedByMonth();
    }

    /** Money in on the bank statement, per month (poultry and own transfers left out). */
    @GetMapping("/bank-received")
    public List<Map<String, Object>> getBankReceived() {
        return incomeService.getBankReceivedByMonth();
    }

    /** Notes on months' money in from the bank (e.g. which month a payment was for). */
    @GetMapping("/bank-received/notes")
    public List<Map<String, Object>> getBankMonthNotes() {
        return incomeService.getBankMonthNotes();
    }

    /** Body: {note}. A blank note removes it. */
    @PreAuthorize("@ss.can('LEDGER', 'EDIT')")
    @PutMapping("/bank-received/{month}/note")
    public Map<String, Object> saveBankMonthNote(@PathVariable String month, @RequestBody Map<String, Object> body) {
        Object note = body.get("note");
        return incomeService.saveBankMonthNote(month, note == null ? null : note.toString());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Income> getIncomeById(@PathVariable Long id) {
        return incomeService.getIncomeById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    @PreAuthorize("@ss.can('LEDGER', 'CREATE')")
    public Income createIncome(@RequestBody Income income) {
        return incomeService.saveIncome(income);
    }

    @PutMapping("/{id}")
    @PreAuthorize("@ss.can('LEDGER', 'EDIT')")
    public ResponseEntity<Income> updateIncome(@PathVariable Long id, @RequestBody Income income) {
        return incomeService.getIncomeById(id)
                .map(existing -> {
                    income.setId(id);
                    return ResponseEntity.ok(incomeService.saveIncome(income));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("@ss.can('LEDGER', 'DELETE')")
    public ResponseEntity<Void> deleteIncome(@PathVariable Long id) {
        incomeService.deleteIncome(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/range")
    public List<Income> getIncomeByRange(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate start,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate end) {
        return incomeService.getIncomeByDateRange(start, end);
    }
}
