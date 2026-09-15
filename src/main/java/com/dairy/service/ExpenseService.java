package com.dairy.service;

import com.dairy.model.Expense;
import com.dairy.repo.ExpenseRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.List;
import java.util.Optional;

@Service
public class ExpenseService {

    @Autowired
    private ExpenseRepository expenseRepository;

    public List<Expense> getAllExpenses() {
        return expenseRepository.findAll();
    }

    public Optional<Expense> getExpenseById(Long id) {
        return expenseRepository.findById(id);
    }

    public Expense saveExpense(Expense expense) {
        return expenseRepository.save(expense);
    }

    public void deleteExpense(Long id) {
        expenseRepository.deleteById(id);
    }

    public List<Expense> getExpensesByCategory(String category) {
        return expenseRepository.findByCategory(category);
    }

    public List<Expense> getExpensesByDateRange(LocalDate start, LocalDate end) {
        return expenseRepository.findByDateBetween(start, end);
    }

    public Double getTotalExpenseByDateRange(LocalDate start, LocalDate end) {
        return expenseRepository.findByDateBetween(start, end)
                .stream()
                .mapToDouble(Expense::getAmount)
                .sum();
    }

    /**
     * Marks all unsettled expenses paid by the given staff member as settled.
     * If month is null/"ALL", settles across all time; otherwise restricts to that month (yyyy-MM).
     */
    public List<Expense> settleExpensesForStaff(String paidBy, String month) {
        List<Expense> unsettled;
        if (month == null || month.isBlank() || "ALL".equalsIgnoreCase(month)) {
            unsettled = expenseRepository.findByPaidByAndSettledFalse(paidBy);
        } else {
            YearMonth ym = YearMonth.parse(month);
            unsettled = expenseRepository.findByPaidByAndSettledFalseAndDateBetween(
                    paidBy, ym.atDay(1), ym.atEndOfMonth());
        }

        String settledBy = SecurityContextHolder.getContext().getAuthentication() != null
                ? SecurityContextHolder.getContext().getAuthentication().getName()
                : null;
        LocalDateTime now = LocalDateTime.now();

        for (Expense e : unsettled) {
            e.setSettled(true);
            e.setSettledAt(now);
            e.setSettledBy(settledBy);
        }
        return expenseRepository.saveAll(unsettled);
    }
}
