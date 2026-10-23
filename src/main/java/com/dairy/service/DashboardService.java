package com.dairy.service;

import com.dairy.dto.DashboardDTO;
import com.dairy.model.Expense;
import com.dairy.model.Income;
import com.dairy.model.MilkRecord;
import com.dairy.model.Herd;
import com.dairy.repo.ExpenseRepository;
import com.dairy.repo.HerdRepository;
import com.dairy.repo.HerdEventRepository;
import com.dairy.model.HerdEvent;
import com.dairy.repo.IncomeRepository;
import com.dairy.repo.MilkRecordRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class DashboardService {

    @Autowired
    private MilkRecordRepository milkRecordRepository;

    @Autowired
    private HerdRepository herdRepository;

    @Autowired
    private HerdEventRepository herdEventRepository;

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
        // Joined to the animal up front: the Top Milkers section below reads record.getHerd(),
        // which is lazy and would otherwise fetch one row per cow milked today.
        List<MilkRecord> todayRecords = milkRecordRepository.findByDateWithHerd(today);
        List<MilkRecord> yesterdayRecords = milkRecordRepository.findByDateWithHerd(yesterday);
        
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

        // 3. Current Month & Totals
        LocalDate startOfMonth = today.withDayOfMonth(1);
        List<MilkRecord> monthRecords = milkRecordRepository.findByDateBetween(startOfMonth, today);
        double monthMilk = monthRecords.stream().mapToDouble(r -> r.getQuantity() != null ? r.getQuantity() : 0.0).sum();
        dto.setMonthMilkProduction(monthMilk);
        
        List<Income> monthIncomes = incomeRepository.findByDateBetween(startOfMonth, today);
        List<Expense> monthExpenses = expenseRepository.findByDateBetween(startOfMonth, today);
        
        double monthRevenue = monthIncomes.stream().mapToDouble(i -> i.getAmount() != null ? i.getAmount() : 0.0).sum();
        double monthExpense = monthExpenses.stream().mapToDouble(e -> e.getAmount() != null ? e.getAmount() : 0.0).sum();
        
        dto.setMonthRevenue(monthRevenue);
        dto.setMonthExpense(monthExpense);
        
        dto.setTodayProfit(todayRevenue - todayExpenseValue);
        dto.setCurrentMonthProfit(monthRevenue - monthExpense);
        
        Double totalMilk = milkRecordRepository.getTotalMilkProduction();
        dto.setTotalMilkProduction(totalMilk != null ? totalMilk : 0.0);
        
        Double totalRev = incomeRepository.getTotalRevenue();
        dto.setTotalRevenue(totalRev != null ? totalRev : 0.0);
        
        Double totalExp = expenseRepository.getTotalExpense();
        dto.setTotalExpense(totalExp != null ? totalExp : 0.0);
        
        dto.setTotalProfit((totalRev != null ? totalRev : 0.0) - (totalExp != null ? totalExp : 0.0));
        
        // Expense Pie Chart Data
        List<Object[]> pieDataRaw = expenseRepository.getExpensePieChartData();
        Map<String, Double> pieData = new LinkedHashMap<>();
        for (Object[] row : pieDataRaw) {
            String cat = (String) row[0];
            Double amt = (Double) row[1];
            pieData.put(cat != null ? cat : "Other", amt != null ? amt : 0.0);
        }
        dto.setExpensePieChartData(pieData);

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
        
        // Read the whole six-month window once and bucket it by month. This loop used to issue
        // an income query and an expense query per month - twelve round trips for one chart.
        LocalDate windowStart = today.minusMonths(5).withDayOfMonth(1);
        LocalDate windowEnd = today.withDayOfMonth(today.lengthOfMonth());

        Map<YearMonth, Double> revByMonth = new HashMap<>();
        for (Income inc : incomeRepository.findByDateBetween(windowStart, windowEnd)) {
            if (inc.getDate() == null) continue;
            revByMonth.merge(YearMonth.from(inc.getDate()), inc.getAmount() != null ? inc.getAmount() : 0.0, Double::sum);
        }

        Map<YearMonth, Double> expByMonth = new HashMap<>();
        for (Expense exp : expenseRepository.findByDateBetween(windowStart, windowEnd)) {
            if (exp.getDate() == null) continue;
            expByMonth.merge(YearMonth.from(exp.getDate()), exp.getAmount() != null ? exp.getAmount() : 0.0, Double::sum);
        }

        for (int i = 5; i >= 0; i--) {
            LocalDate monthDate = today.minusMonths(i);
            YearMonth month = YearMonth.from(monthDate);

            revData.put(monthDate.format(monthFormatter), revByMonth.getOrDefault(month, 0.0));
            expData.put(monthDate.format(monthFormatter), expByMonth.getOrDefault(month, 0.0));
        }
        
        dto.setRevenueChartData(revData);
        dto.setExpenseChartData(expData);

        // 6. Top milkers, today and yesterday
        dto.setTopMilkers(topMilkers(todayRecords));
        dto.setTopMilkersYesterday(topMilkers(yesterdayRecords));

        dto.setPeakYields(peakYields());

        return dto;
    }

    /** The five best milkers in a day's records, morning and evening summed. Cows at 0 L are left out. */
    private List<DashboardDTO.TopMilkerDTO> topMilkers(List<MilkRecord> records) {
        Map<String, DashboardDTO.TopMilkerDTO> milkerMap = new HashMap<>();
        for (MilkRecord r : records) {
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

        List<DashboardDTO.TopMilkerDTO> top = new ArrayList<>(milkerMap.values());
        top.removeIf(tm -> tm.getTotalYield() == null || tm.getTotalYield() <= 0);
        top.sort((x, y) -> y.getTotalYield().compareTo(x.getTotalYield()));
        return top.stream().limit(5).collect(Collectors.toList());
    }

    /**
     * Highest single-day milk total ever recorded for each animal, disposed ones included, with its
     * average over the last 30 days so a drop from peak is visible. Highest peak first.
     */
    private List<DashboardDTO.PeakYieldDTO> peakYields() {
        LocalDate recentFrom = LocalDate.now().minusDays(30);
        // Morning and evening per animal per day: herdId -> date -> [morning, evening]
        Map<Long, Map<LocalDate, double[]>> daysByHerd = new HashMap<>();
        for (Object[] row : milkRecordRepository.sumShiftByHerd()) {
            if (row[0] == null || row[1] == null) continue;
            Long herdId = ((Number) row[0]).longValue();
            LocalDate date = (LocalDate) row[1];
            boolean morning = "Morning".equalsIgnoreCase(row[2] != null ? row[2].toString() : null);
            double litres = row[3] != null ? ((Number) row[3]).doubleValue() : 0.0;
            daysByHerd.computeIfAbsent(herdId, k -> new HashMap<>())
                    .computeIfAbsent(date, k -> new double[2])[morning ? 0 : 1] += litres;
        }

        Map<Long, double[]> statsByHerd = new HashMap<>();   // [peak, recentSum, recentDays, peakMorning, peakEvening]
        Map<Long, LocalDate> peakDateByHerd = new HashMap<>();
        for (Map.Entry<Long, Map<LocalDate, double[]>> herdDays : daysByHerd.entrySet()) {
          Long herdId = herdDays.getKey();
          for (Map.Entry<LocalDate, double[]> day : herdDays.getValue().entrySet()) {
            LocalDate date = day.getKey();
            double litres = day.getValue()[0] + day.getValue()[1];
            double[] s = statsByHerd.computeIfAbsent(herdId, k -> new double[5]);
            if (litres > s[0] || (litres == s[0] && date.isAfter(peakDateByHerd.get(herdId)))) {
                s[0] = litres;
                s[3] = day.getValue()[0];
                s[4] = day.getValue()[1];
                peakDateByHerd.put(herdId, date);
            }
            if (!date.isBefore(recentFrom)) {
                s[1] += litres;
                s[2]++;
            }
          }
        }
        if (statsByHerd.isEmpty()) return List.of();

        // Calvings, to work out how far into lactation each peak came.
        Map<Long, List<LocalDate>> calvingsByHerd = new HashMap<>();
        for (HerdEvent e : herdEventRepository.findByHerdIdInOrderByEventDateDesc(statsByHerd.keySet())) {
            String t = e.getEventType();
            if (e.getEventDate() != null && ("CALF_DELIVERED".equalsIgnoreCase(t) || "CALVING".equalsIgnoreCase(t)
                    || "LACTATION_STARTED".equalsIgnoreCase(t))) {
                calvingsByHerd.computeIfAbsent(e.getHerdId(), k -> new ArrayList<>()).add(e.getEventDate());
            }
        }

        List<DashboardDTO.PeakYieldDTO> result = new ArrayList<>();
        for (Herd herd : herdRepository.findAllById(statsByHerd.keySet())) {
            double[] s = statsByHerd.get(herd.getId());
            if (s[0] <= 0) continue;
            String cowId = herd.getTagNumber() != null ? herd.getTagNumber() : String.valueOf(herd.getId());
            String cowName = herd.getAnimalName() != null ? herd.getAnimalName() : "Unknown";
            Double recent = s[2] > 0 ? s[1] / s[2] : null;
            LocalDate peakDate = peakDateByHerd.get(herd.getId());
            Integer dimAtPeak = null;
            for (LocalDate calved : calvingsByHerd.getOrDefault(herd.getId(), List.of())) {
                // Newest first, so the first calving on or before the peak is the one that started that lactation.
                if (!calved.isAfter(peakDate)) {
                    dimAtPeak = (int) java.time.temporal.ChronoUnit.DAYS.between(calved, peakDate);
                    break;
                }
            }
            result.add(new DashboardDTO.PeakYieldDTO(cowId, cowName, s[0], peakDate, recent,
                    "DISPOSED".equalsIgnoreCase(herd.getStatus()), dimAtPeak, s[3], s[4]));
        }
        result.sort((a, b) -> b.getPeakYield().compareTo(a.getPeakYield()));
        return result;
    }
}
