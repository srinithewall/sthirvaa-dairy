package com.dairy.service;

import com.dairy.model.Income;
import com.dairy.model.bank.BankTransaction;
import com.dairy.repo.IncomeRepository;
import com.dairy.repo.bank.BankTransactionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeMap;

@Service
public class IncomeService {

    @Autowired
    private IncomeRepository incomeRepository;

    @Autowired
    private BankTransactionRepository bankTransactionRepository;

    public List<Income> getAllIncome() {
        return incomeRepository.findAll();
    }

    public Optional<Income> getIncomeById(Long id) {
        return incomeRepository.findById(id);
    }

    public Income saveIncome(Income income) {
        return incomeRepository.save(income);
    }

    public void deleteIncome(Long id) {
        incomeRepository.deleteById(id);
    }

    public List<Income> getIncomeByDateRange(LocalDate start, LocalDate end) {
        return incomeRepository.findByDateBetween(start, end);
    }

    /**
     * What the milk society actually paid, by the month it reached the bank: Kotak credits booked as
     * a settlement of MILK_SALES. The daily MILK_SALES income is only the estimate at the AMCS rate;
     * incentives and deductions show up here. pending is credits still only suggested as milk payments.
     */
    public List<Map<String, Object>> getMilkReceivedByMonth() {
        Map<String, double[]> byMonth = new TreeMap<>();
        for (BankTransaction t : bankTransactionRepository.findSettlementCredits("MILK_SALES", Set.of("MAPPED", "SUGGESTED"))) {
            double[] m = byMonth.computeIfAbsent(t.getTxnDate().toString().substring(0, 7), k -> new double[3]);
            if ("MAPPED".equals(t.getStatus())) {
                m[0] += t.getAmount();
                m[2]++;
            } else {
                m[1] += t.getAmount();
            }
        }
        List<Map<String, Object>> out = new ArrayList<>();
        byMonth.forEach((month, m) -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("month", month);
            row.put("received", m[0]);
            row.put("pending", m[1]);
            row.put("payments", (int) m[2]);
            out.add(row);
        });
        return out;
    }
}
