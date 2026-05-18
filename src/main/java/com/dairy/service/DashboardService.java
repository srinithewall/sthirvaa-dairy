package com.dairy.service;

import com.dairy.dto.DashboardDTO;
import com.dairy.model.Expense;
import com.dairy.model.Income;
import com.dairy.model.MilkRecord;
import com.dairy.repo.ExpenseRepository;
import com.dairy.repo.IncomeRepository;
import com.dairy.repo.MilkRecordRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class DashboardService {

    @Autowired
    private MilkRecordRepository milkRecordRepository;

    @Autowired
    private IncomeRepository incomeRepository;

    @Autowired
    private ExpenseRepository expenseRepository;

    @Transactional(readOnly = true)
    public DashboardDTO getDashboardMetrics() {
        DashboardDTO dto = new DashboardDTO();
        LocalDate today = LocalDate.now();
        LocalDate yesterday = today.minusDays(1);
        
        // 1. Milk Production (Today vs Yesterday)
        List<MilkRecord> todayRecords = milkRecordRepository.findByDate(today);
        List<MilkRecord> yesterdayRecords = milkRecordRepository.findByDate(yesterday);
        
        double todayMilk = todayRecords.stream().mapToDouble(r -> r.getQuantity() != null ? r.getQuantity() : 0.0).sum();
        double yesterdayMilk = yesterdayRecords.stream().mapToDouble(r -> r.getQuantity() != null ? r.getQuantity() : 0.0).sum();
        
        dto.setTodayMilkProduction(todayMilk);
        dto.setYesterdayMilkProduction(yesterdayMilk);

        // 2. Revenue & Expense (Today vs Yesterday)
        List<Income> todayIncomes = incomeRepository.findByDateBetween(today, today);
        List<Income> yesterdayIncomes = incomeRepository.findByDateBetween(yesterday, yesterday);
        
        double todayRevenue = todayIncomes.stream().mapToDouble(i -> i.getAmount() != null ? i.getAmount() : 0.0).sum();
        double yesterdayRevenue = yesterdayIncomes.stream().mapToDouble(i -> i.getAmount() != null ? i.getAmount() : 0.0).sum();
        
        dto.setTodayRevenue(todayRevenue);
        dto.setYesterdayRevenue(yesterdayRevenue);
        
        List<Expense> todayExpenses = expenseRepository.findByDateBetween(today, today);
        List<Expense> yesterdayExpenses = expenseRepository.findByDateBetween(yesterday, yesterday);
        
        double todayExpenseValue = todayExpenses.stream().mapToDouble(e -> e.getAmount() != null ? e.getAmount() : 0.0).sum();
        double yesterdayExpenseValue = yesterdayExpenses.stream().mapToDouble(e -> e.getAmount() != null ? e.getAmount() : 0.0).sum();
        
        dto.setTodayExpense(todayExpenseValue);
        dto.setYesterdayExpense(yesterdayExpenseValue);

        // 3. Current Month Profit
        LocalDate startOfMonth = today.withDayOfMonth(1);
        List<Income> monthIncomes = incomeRepository.findByDateBetween(startOfMonth, today);
        List<Expense> monthExpenses = expenseRepository.findByDateBetween(startOfMonth, today);
        
        double monthRevenue = monthIncomes.stream().mapToDouble(i -> i.getAmount() != null ? i.getAmount() : 0.0).sum();
        double monthExpense = monthExpenses.stream().mapToDouble(e -> e.getAmount() != null ? e.getAmount() : 0.0).sum();
        
        dto.setCurrentMonthProfit(monthRevenue - monthExpense);

        // 4. Production Chart Data (Last 14 Days)
        LocalDate twoWeeksAgo = today.minusDays(13);
        List<MilkRecord> twoWeeksRecords = milkRecordRepository.findByDateBetween(twoWeeksAgo, today);
        
        Map<String, Double> prodData = new LinkedHashMap<>();
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("d MMM");
        
        for (int i = 13; i >= 0; i--) {
            LocalDate d = today.minusDays(i);
            double dailyTotal = twoWeeksRecords.stream()
                .filter(r -> r.getDate().equals(d))
                .mapToDouble(r -> r.getQuantity() != null ? r.getQuantity() : 0.0)
                .sum();
            prodData.put(d.format(formatter), dailyTotal);
        }
        dto.setProductionChartData(prodData);

        // 5. Finance Chart Data (Last 6 Months)
        Map<String, Double> revData = new LinkedHashMap<>();
        Map<String, Double> expData = new LinkedHashMap<>();
        DateTimeFormatter monthFormatter = DateTimeFormatter.ofPattern("MMM");
        
        for (int i = 5; i >= 0; i--) {
            LocalDate monthDate = today.minusMonths(i);
            LocalDate start = monthDate.withDayOfMonth(1);
            LocalDate end = monthDate.withDayOfMonth(monthDate.lengthOfMonth());
            
            double mRev = incomeRepository.findByDateBetween(start, end)
                .stream().mapToDouble(inc -> inc.getAmount() != null ? inc.getAmount() : 0.0).sum();
            double mExp = expenseRepository.findByDateBetween(start, end)
                .stream().mapToDouble(exp -> exp.getAmount() != null ? exp.getAmount() : 0.0).sum();
                
            revData.put(monthDate.format(monthFormatter), mRev);
            expData.put(monthDate.format(monthFormatter), mExp);
        }
        
        dto.setRevenueChartData(revData);
        dto.setExpenseChartData(expData);

        // 6. Top Milkers Today
        Map<String, DashboardDTO.TopMilkerDTO> milkerMap = new HashMap<>();
        for (MilkRecord r : todayRecords) {
            if (r.getHerd() == null) continue;
            String cowId = r.getHerd().getTagNumber() != null ? r.getHerd().getTagNumber() : String.valueOf(r.getHerd().getId());
            String cowName = r.getHerd().getAnimalName() != null ? r.getHerd().getAnimalName() : "Unknown";
            double qty = r.getQuantity() != null ? r.getQuantity() : 0.0;

            DashboardDTO.TopMilkerDTO tm = milkerMap.getOrDefault(cowId,
                new DashboardDTO.TopMilkerDTO(cowId, cowName, 0.0, 0.0, 0.0));

            if ("Morning".equalsIgnoreCase(r.getShift())) {
                tm = new DashboardDTO.TopMilkerDTO(cowId, cowName, tm.getMorningYield() + qty, tm.getEveningYield(), tm.getTotalYield() + qty);
            } else {
                tm = new DashboardDTO.TopMilkerDTO(cowId, cowName, tm.getMorningYield(), tm.getEveningYield() + qty, tm.getTotalYield() + qty);
            }
            milkerMap.put(cowId, tm);
        }
        
        List<DashboardDTO.TopMilkerDTO> topMilkers = new ArrayList<>(milkerMap.values());
        topMilkers.sort((a, b) -> b.getTotalYield().compareTo(a.getTotalYield())); // Descending order
        
        dto.setTopMilkers(topMilkers.stream().limit(5).collect(Collectors.toList()));

        return dto;
    }
}
