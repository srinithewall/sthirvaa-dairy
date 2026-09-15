package com.dairy.repo;

import com.dairy.model.Expense;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.time.LocalDate;
import java.util.List;

public interface ExpenseRepository extends JpaRepository<Expense, Long> {
    List<Expense> findByCategory(String category);
    List<Expense> findByDateBetween(LocalDate startDate, LocalDate endDate);
    List<Expense> findByPaidByAndSettledFalse(String paidBy);
    List<Expense> findByPaidByAndSettledFalseAndDateBetween(String paidBy, LocalDate startDate, LocalDate endDate);
    
    @Query("SELECT SUM(e.amount) FROM Expense e")
    Double getTotalExpense();

    @Query("SELECT e.category, SUM(e.amount) FROM Expense e GROUP BY e.category ORDER BY SUM(e.amount) DESC")
    List<Object[]> getExpensePieChartData();
}
