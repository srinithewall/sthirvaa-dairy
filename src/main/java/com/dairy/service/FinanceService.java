package com.dairy.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;

@Service
public class FinanceService {

    @Autowired
    private ExpenseService expenseService;

    @Autowired
    private SaleService saleService;

    @Autowired
    private com.dairy.repo.IncomeRepository incomeRepository;

    public Map<String, Object> getFinancialSummary(LocalDate start, LocalDate end) {
        Double salesIncome = saleService.getTotalIncomeByDateRange(start, end);
        Double generalIncome = incomeRepository.findByDateBetween(start, end)
                .stream()
                .mapToDouble(com.dairy.model.Income::getAmount)
                .sum();
        
        Double totalIncome = salesIncome + generalIncome;
        Double totalExpense = expenseService.getTotalExpenseByDateRange(start, end);
        
        Map<String, Object> summary = new HashMap<>();
        summary.put("startDate", start);
        summary.put("endDate", end);
        summary.put("salesIncome", salesIncome);
        summary.put("generalIncome", generalIncome);
        summary.put("totalIncome", totalIncome);
        summary.put("totalExpense", totalExpense);
        summary.put("netProfit", totalIncome - totalExpense);
        
        return summary;
    }
}
