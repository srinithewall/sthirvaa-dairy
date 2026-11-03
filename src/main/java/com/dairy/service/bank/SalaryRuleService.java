package com.dairy.service.bank;

import com.dairy.model.Expense;
import com.dairy.model.Staff;
import com.dairy.model.bank.SalaryAdvance;
import com.dairy.model.bank.SalaryRule;
import com.dairy.repo.ExpenseRepository;
import com.dairy.repo.StaffRepository;
import com.dairy.repo.bank.SalaryAdvanceRepository;
import com.dairy.repo.bank.SalaryRuleRepository;
import com.dairy.service.IncomeService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Salary rules per employee and what each comes to for a month. See SalaryRule. */
@Service
public class SalaryRuleService {

    @Autowired private SalaryRuleRepository ruleRepository;
    @Autowired private StaffRepository staffRepository;
    @Autowired private ExpenseRepository expenseRepository;
    @Autowired private IncomeService incomeService;
    @Autowired private SalaryAdvanceRepository advanceRepository;

    public List<Map<String, Object>> list() {
        Map<Long, Staff> staff = staffById();
        List<Map<String, Object>> out = new ArrayList<>();
        for (SalaryRule r : ruleRepository.findAll()) {
            Staff s = staff.get(r.getStaffId());
            if (s == null) continue;
            Map<String, Object> row = view(r);
            row.put("staffName", s.getName());
            out.add(row);
        }
        out.sort(Comparator.comparing(m -> m.get("staffName").toString()));
        return out;
    }

    /** Everyone a rule can be set for, with the salary on their staff record. */
    public List<Map<String, Object>> staff() {
        return staffRepository.findAll().stream()
            .sorted(Comparator.comparing(Staff::getName))
            .map(s -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("id", s.getId());
                m.put("name", s.getName());
                m.put("salary", s.getSalary());
                return m;
            }).toList();
    }

    @Transactional
    public Map<String, Object> save(Long staffId, Map<String, Object> body) {
        Staff staff = staffRepository.findById(staffId)
            .orElseThrow(() -> new NoSuchElementException("Staff " + staffId + " not found"));
        String type = body.get("type") == null ? "" : body.get("type").toString().trim().toUpperCase();
        if (!type.equals("FIXED") && !type.equals("DYNAMIC")) throw new IllegalArgumentException("Choose Fixed or Dynamic");

        SalaryRule r = ruleRepository.findByStaffId(staffId).orElseGet(SalaryRule::new);
        r.setStaffId(staffId);
        r.setType(type);
        if (type.equals("FIXED")) {
            Double fixed = positive(body.get("fixedAmount"));
            if (fixed == null) throw new IllegalArgumentException("Enter the fixed salary");
            r.setFixedAmount(fixed);
            r.setSharePercent(null);
        } else {
            Double pct = positive(body.get("sharePercent"));
            if (pct == null || pct > 100) throw new IllegalArgumentException("Profit share must be between 1 and 100 %");
            r.setSharePercent(pct);
            r.setFixedAmount(null);
        }

        r.setUpdatedBy(currentUser());
        Map<String, Object> row = view(ruleRepository.save(r));
        row.put("staffName", staff.getName());
        return row;
    }

    @Transactional
    public void delete(Long staffId) {
        ruleRepository.findByStaffId(staffId).ifPresent(ruleRepository::delete);
    }

    // ------------------------------------------------------------------ advances

    /**
     * The employee's advance account up to `month` (YYYY-MM): every advance and repayment, the
     * month-by-month schedule, and totals - given, recovered (cuts plus repayments) and left.
     */
    public Map<String, Object> advances(Long staffId, String month) {
        YearMonth ym = YearMonth.parse(month);
        List<SalaryAdvance> entries = advanceRepository.findByStaffIdOrderByDateAscIdAsc(staffId);
        List<AdvanceSchedule.Month> rows = AdvanceSchedule.build(entries, ym);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("entries", entries.stream().map(SalaryRuleService::entryView).toList());
        out.put("schedule", rows.stream().map(r -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("month", r.month().toString());
            m.put("given", r.given());
            m.put("repaid", r.repaid());
            m.put("planned", r.planned());
            m.put("cut", r.cut());
            m.put("left", r.left());
            return m;
        }).toList());
        out.put("totals", totals(rows, ym));
        return out;
    }

    /** Body: type GIVEN (date, amount, terms, startMonth, mode, note) or REPAID (date, amount, mode, note). */
    @Transactional
    public Map<String, Object> addAdvance(Long staffId, Map<String, Object> body) {
        staffRepository.findById(staffId).orElseThrow(() -> new NoSuchElementException("Staff " + staffId + " not found"));
        String type = body.get("type") == null ? "" : body.get("type").toString().trim().toUpperCase();
        if (!type.equals("GIVEN") && !type.equals("REPAID")) throw new IllegalArgumentException("Choose advance given or repaid");
        Double amount = positive(body.get("amount"));
        if (amount == null) throw new IllegalArgumentException("Enter the amount");
        LocalDate date;
        try {
            date = LocalDate.parse(String.valueOf(body.get("date")));
        } catch (RuntimeException ex) {
            throw new IllegalArgumentException("Choose the date");
        }
        SalaryAdvance a = new SalaryAdvance();
        a.setStaffId(staffId);
        a.setType(type);
        a.setDate(date);
        a.setAmount(amount);
        String mode = body.get("mode") == null ? "CASH" : body.get("mode").toString().trim().toUpperCase();
        a.setMode(mode.equals("BANK") ? "BANK" : "CASH");
        a.setNote(body.get("note") == null || body.get("note").toString().isBlank() ? null : body.get("note").toString().trim());
        if (type.equals("GIVEN")) {
            Double terms = positive(body.get("terms"));
            if (terms == null || terms != Math.floor(terms)) throw new IllegalArgumentException("Enter the months to cut it over");
            String start = body.get("startMonth") == null ? "" : body.get("startMonth").toString().trim();
            YearMonth startMonth;
            try {
                startMonth = YearMonth.parse(start);
            } catch (DateTimeParseException ex) {
                throw new IllegalArgumentException("Choose the month the cuts start");
            }
            if (startMonth.isBefore(YearMonth.from(date))) {
                throw new IllegalArgumentException("The cuts cannot start before the advance was given");
            }
            a.setTerms(terms.intValue());
            a.setStartMonth(start);
        } else if (amount > owedOn(staffId, date) + 0.5) {
            throw new IllegalArgumentException("That is more than is owed (" + Math.round(owedOn(staffId, date)) + ")");
        }
        a.setCreatedBy(currentUser());
        advanceRepository.save(a);
        return advances(staffId, YearMonth.from(date).toString());
    }

    @Transactional
    public void deleteAdvance(Long staffId, Long id) {
        advanceRepository.findById(id).filter(a -> a.getStaffId().equals(staffId)).ifPresent(advanceRepository::delete);
    }

    /** What is owed at the start of the month of `date`, after that month's advances and repayments so far. */
    private double owedOn(Long staffId, LocalDate date) {
        YearMonth m = YearMonth.from(date);
        AdvanceSchedule.Month row = AdvanceSchedule.at(
            AdvanceSchedule.build(advanceRepository.findByStaffIdOrderByDateAscIdAsc(staffId), m), m);
        return row.left() + row.cut() + row.repaid(); // before this month's cut and repayments
    }

    /** Given, repaid and cut up to and including `upTo`, and what is left after it. */
    private static Map<String, Object> totals(List<AdvanceSchedule.Month> rows, YearMonth upTo) {
        long given = 0, repaid = 0, cut = 0, futureMonths = 0;
        for (AdvanceSchedule.Month r : rows) {
            if (!r.month().isAfter(upTo)) {
                given += r.given();
                repaid += r.repaid();
                cut += r.cut();
            } else if (r.cut() > 0) {
                futureMonths++;
            }
        }
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("upTo", upTo.toString());
        m.put("given", given);
        m.put("repaid", repaid);
        m.put("cut", cut);
        m.put("recovered", repaid + cut);
        m.put("left", AdvanceSchedule.at(rows, upTo).left());
        m.put("monthsLeft", futureMonths);
        return m;
    }

    private static Map<String, Object> entryView(SalaryAdvance a) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", a.getId());
        m.put("date", a.getDate());
        m.put("type", a.getType());
        m.put("amount", a.getAmount());
        m.put("terms", a.getTerms());
        m.put("startMonth", a.getStartMonth());
        m.put("mode", a.getMode());
        m.put("note", a.getNote());
        if ("GIVEN".equals(a.getType()) && a.getTerms() != null) m.put("monthlyCut", Math.round(a.getAmount() / a.getTerms()));
        return m;
    }

    /**
     * Rules from before advances were a list kept one advance on the rule itself. Move each into the
     * list once (given in cash, dated the 1st of its first cut month) and clear it from the rule.
     */
    @Transactional
    public int moveRuleAdvancesToList() {
        int moved = 0;
        for (SalaryRule r : ruleRepository.findAll()) {
            if (r.getAdvanceAmount() == null || r.getAdvanceTerms() == null || r.getAdvanceStartMonth() == null) continue;
            if (!advanceRepository.existsByStaffId(r.getStaffId())) {
                SalaryAdvance a = new SalaryAdvance();
                a.setStaffId(r.getStaffId());
                a.setType("GIVEN");
                a.setDate(YearMonth.parse(r.getAdvanceStartMonth()).atDay(1));
                a.setAmount(r.getAdvanceAmount());
                a.setTerms(r.getAdvanceTerms());
                a.setStartMonth(r.getAdvanceStartMonth());
                a.setMode("CASH");
                a.setNote("Moved from the salary rule; change the date if it was given earlier");
                a.setCreatedBy(r.getUpdatedBy());
                advanceRepository.save(a);
                moved++;
            }
            r.setAdvanceAmount(null);
            r.setAdvanceTerms(null);
            r.setAdvanceStartMonth(null);
            ruleRepository.save(r);
        }
        return moved;
    }

    /**
     * Each rule worked out for the month (YYYY-MM). Dynamic rules share the dairy's profit: the
     * society's milk payments received in the bank that month minus the month's cattle expenses
     * in the ledger. A loss gives no share. The advance cut comes off either way.
     */
    public Map<String, Object> calculate(String month) {
        YearMonth ym = YearMonth.parse(month);
        double milkReceived = incomeService.getMilkReceivedByMonth().stream()
            .filter(m -> month.equals(m.get("month")))
            .mapToDouble(m -> ((Number) m.get("received")).doubleValue()).sum();
        double expenses = expenseRepository.findByDateBetween(ym.atDay(1), ym.atEndOfMonth()).stream()
            .filter(SalaryRuleService::isCattle)
            .mapToDouble(e -> e.getAmount() == null ? 0 : e.getAmount()).sum();
        double profit = Math.round(milkReceived) - Math.round(expenses);

        List<Map<String, Object>> rows = new ArrayList<>();
        for (Map<String, Object> rule : list()) {
            SalaryRule r = ruleRepository.findByStaffId((Long) rule.get("staffId")).orElseThrow();
            long earned = "FIXED".equals(r.getType())
                ? Math.round(r.getFixedAmount())
                : Math.round(Math.max(0, profit) * r.getSharePercent() / 100.0);
            List<AdvanceSchedule.Month> schedule =
                AdvanceSchedule.build(advanceRepository.findByStaffIdOrderByDateAscIdAsc(r.getStaffId()), ym);
            AdvanceSchedule.Month now = AdvanceSchedule.at(schedule, ym);
            Map<String, Object> row = new LinkedHashMap<>(rule);
            row.put("earned", earned);
            row.put("advanceCut", now.cut());
            row.put("advanceLeft", now.left());
            row.put("advance", totals(schedule, ym));
            row.put("payable", earned - now.cut());
            rows.add(row);
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("month", month);
        out.put("milkReceived", Math.round(milkReceived));
        out.put("expenses", Math.round(expenses));
        out.put("profit", Math.round(profit));
        out.put("rows", rows);
        return out;
    }

    /** Same split the Digital Ledger uses: blank or CATTLE, and not the Poultry category. */
    private static boolean isCattle(Expense e) {
        return !"POULTRY".equals(e.getSegment()) && !"Poultry".equals(e.getCategory());
    }

    private Map<String, Object> view(SalaryRule r) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("staffId", r.getStaffId());
        m.put("type", r.getType());
        m.put("fixedAmount", r.getFixedAmount());
        m.put("sharePercent", r.getSharePercent());
        return m;
    }

    private Map<Long, Staff> staffById() {
        return staffRepository.findAll().stream().collect(Collectors.toMap(Staff::getId, Function.identity()));
    }

    private static Double positive(Object o) {
        if (o == null || o.toString().isBlank()) return null;
        try {
            double d = Double.parseDouble(o.toString().trim());
            return d > 0 ? d : null;
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private static String currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth == null ? "system" : auth.getName();
    }
}
