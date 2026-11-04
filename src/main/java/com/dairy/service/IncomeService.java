package com.dairy.service;

import com.dairy.model.Income;
import com.dairy.model.bank.BankMonthNote;
import com.dairy.model.bank.BankTransaction;
import com.dairy.repo.IncomeRepository;
import com.dairy.repo.bank.BankMonthNoteRepository;
import com.dairy.repo.bank.BankTransactionRepository;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
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
    private BankMonthNoteRepository noteRepository;

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

    /**
     * Money in on the bank statement, per month: every credit except lines set aside as not
     * business money (own transfers, reversals) and poultry. Booked ones count as received;
     * ones not reviewed yet are shown apart. A month with any bank line has a statement.
     * [{month, received, unreviewed, credits, hasStatement}]
     */
    public List<Map<String, Object>> getBankReceivedByMonth() {
        Map<String, double[]> byMonth = new TreeMap<>();
        for (BankTransaction t : bankTransactionRepository.findAll()) {
            if (t.getTxnDate() == null) continue;
            double[] m = byMonth.computeIfAbsent(t.getTxnDate().toString().substring(0, 7), k -> new double[3]);
            if (!"CREDIT".equals(t.getDirection()) || t.getAmount() == null) continue;
            if ("IGNORED".equals(t.getStatus()) || "IGNORE".equals(t.getKind()) || "POULTRY".equals(t.getSegment())) continue;
            if ("MAPPED".equals(t.getStatus())) m[0] += t.getAmount(); else m[1] += t.getAmount();
            m[2]++;
        }
        List<Map<String, Object>> out = new ArrayList<>();
        byMonth.forEach((month, m) -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("month", month);
            row.put("received", Math.round(m[0]));
            row.put("unreviewed", Math.round(m[1]));
            row.put("credits", (int) m[2]);
            row.put("hasStatement", true);
            out.add(row);
        });
        return out;
    }

    /** Notes on months' money in from the bank: [{month, note, updatedBy, updatedAt}]. */
    public List<Map<String, Object>> getBankMonthNotes() {
        return noteRepository.findAll().stream()
            .sorted(java.util.Comparator.comparing(BankMonthNote::getMonth))
            .map(IncomeService::noteView).toList();
    }

    /** Sets the month's note; a blank note removes it. Returns the note, or month alone if removed. */
    @Transactional
    public Map<String, Object> saveBankMonthNote(String month, String text) {
        try {
            YearMonth.parse(month);
        } catch (DateTimeParseException ex) {
            throw new IllegalArgumentException("Month must be YYYY-MM");
        }
        String note = text == null ? "" : text.trim();
        if (note.length() > 1000) throw new IllegalArgumentException("Keep the note under 1000 characters");
        Optional<BankMonthNote> existing = noteRepository.findByMonth(month);
        if (note.isEmpty()) {
            existing.ifPresent(noteRepository::delete);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("month", month);
            m.put("note", null);
            return m;
        }
        BankMonthNote n = existing.orElseGet(BankMonthNote::new);
        n.setMonth(month);
        n.setNote(note);
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        n.setUpdatedBy(auth == null ? "system" : auth.getName());
        return noteView(noteRepository.save(n));
    }

    private static Map<String, Object> noteView(BankMonthNote n) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("month", n.getMonth());
        m.put("note", n.getNote());
        m.put("updatedBy", n.getUpdatedBy());
        m.put("updatedAt", n.getUpdatedAt());
        return m;
    }
}
