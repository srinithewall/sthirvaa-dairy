package com.dairy.service.bank;

import com.dairy.model.Expense;
import com.dairy.model.Income;
import com.dairy.model.bank.BankTransaction;
import com.dairy.model.Staff;
import com.dairy.model.bank.SalaryAdvance;
import com.dairy.model.bank.SalaryRule;
import com.dairy.repo.ExpenseRepository;
import com.dairy.repo.IncomeRepository;
import com.dairy.repo.bank.BankTransactionRepository;
import com.dairy.repo.StaffRepository;
import com.dairy.repo.bank.SalaryAdvanceRepository;
import com.dairy.repo.bank.SalaryRuleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * A profit-sharing partner's pay: share of (milk received - cattle expenses), less the month's
 * advance cut; and the advance account - several advances, repayments ending the cuts early.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SalaryRuleServiceTest {

    @Mock private SalaryRuleRepository ruleRepository;
    @Mock private StaffRepository staffRepository;
    @Mock private ExpenseRepository expenseRepository;
    @Mock private SalaryAdvanceRepository advanceRepository;
    @Mock private IncomeRepository incomeRepository;
    @Mock private BankTransactionRepository bankRepository;

    private SalaryRuleService service;
    private SalaryRule lokesh;
    private final List<SalaryAdvance> advances = new ArrayList<>();

    @BeforeEach
    void setUp() {
        service = new SalaryRuleService();
        ReflectionTestUtils.setField(service, "ruleRepository", ruleRepository);
        ReflectionTestUtils.setField(service, "staffRepository", staffRepository);
        ReflectionTestUtils.setField(service, "expenseRepository", expenseRepository);
        ReflectionTestUtils.setField(service, "advanceRepository", advanceRepository);
        ReflectionTestUtils.setField(service, "incomeRepository", incomeRepository);
        ReflectionTestUtils.setField(service, "bankRepository", bankRepository);

        Staff staff = new Staff();
        staff.setId(7L);
        staff.setName("Lokesh HG");
        when(staffRepository.findAll()).thenReturn(List.of(staff));
        when(staffRepository.findById(7L)).thenReturn(Optional.of(staff));

        lokesh = new SalaryRule();
        lokesh.setStaffId(7L);
        lokesh.setType("DYNAMIC");
        lokesh.setSharePercent(50.0);
        when(ruleRepository.findAll()).thenReturn(List.of(lokesh));
        when(ruleRepository.findByStaffId(7L)).thenReturn(Optional.of(lokesh));

        advances.add(given("2026-10-01", 65000, 18, "2026-10"));
        when(advanceRepository.findByStaffIdOrderByDateAscIdAsc(7L)).thenAnswer(inv -> advances);
        when(advanceRepository.save(any())).thenAnswer(inv -> {
            SalaryAdvance a = inv.getArgument(0);
            if (advances.stream().noneMatch(x -> x == a)) advances.add(a); // saving a changed one keeps it once
            return a;
        });
    }

    private static SalaryAdvance given(String date, double amount, int terms, String start) {
        SalaryAdvance a = new SalaryAdvance();
        a.setStaffId(7L);
        a.setType("GIVEN");
        a.setDate(LocalDate.parse(date));
        a.setAmount(amount);
        a.setTerms(terms);
        a.setStartMonth(start);
        return a;
    }

    private static SalaryAdvance repaid(String date, double amount) {
        SalaryAdvance a = new SalaryAdvance();
        a.setStaffId(7L);
        a.setType("REPAID");
        a.setDate(LocalDate.parse(date));
        a.setAmount(amount);
        return a;
    }

    /** October with this much Est. Income (cattle income booked in the app) and these expenses. */
    private void month(double estIncome, Expense... expenses) {
        when(incomeRepository.findByDateBetween(any(), any()))
            .thenReturn(estIncome > 0 ? List.of(income("2026-10-15", estIncome, "MILK_SALES")) : List.of());
        when(expenseRepository.findByDateBetween(any(), any())).thenReturn(List.of(expenses));
    }

    private static Expense expense(double amount, String category, String segment) {
        Expense e = new Expense();
        e.setAmount(amount);
        e.setCategory(category);
        e.setSegment(segment);
        return e;
    }

    @Test
    void sharesHalfTheProfitLessTheAdvanceCut() {
        month(30000, expense(20000, "Feed", null), expense(4000, "Poultry", "POULTRY"));

        Map<String, Object> out = service.calculate("2026-10");
        Map<?, ?> row = (Map<?, ?>) ((List<?>) out.get("rows")).get(0);

        assertEquals(10000L, out.get("profit"), "poultry expenses are not the dairy's");
        assertEquals(5000L, row.get("earned"));
        assertEquals(3611L, row.get("advanceCut"), "65,000 over 18 months");
        assertEquals(1389L, row.get("payable"));
        assertEquals(65000L - 3611L, row.get("advanceLeft"));
    }

    @Test
    void unaccountedExpensesAreNotTakenOffTheProfit() {
        Expense calfFeed = expense(6000, "Calf feed", null);
        calfFeed.setPaidBy("Srinivas");
        calfFeed.setUnaccounted(true);
        month(30000, expense(20000, "Feed", null), calfFeed);

        Map<String, Object> out = service.calculate("2026-10");

        assertEquals(20000L, out.get("expenses"), "the MD's own calf feed is left out");
        assertEquals(10000L, out.get("profit"));
    }

    @Test
    void breakdownLeavesUnaccountedExpensesOut() {
        Expense calfFeed = expenseOn("2026-09-12", 6000, "Calf feed", null);
        calfFeed.setUnaccounted(true);
        when(incomeRepository.findByDateBetween(any(), any())).thenReturn(List.of(income("2026-09-03", 30000, "MILK_SALES")));
        when(expenseRepository.findByDateBetween(any(), any())).thenReturn(List.of(
            expenseOn("2026-09-10", 20000, "Feed", null), calfFeed));

        Map<String, Object> out = service.breakdown(7L, "2026-09", "2026-09", YearMonth.of(2026, 11));
        @SuppressWarnings("unchecked")
        Map<String, Object> sep = ((List<Map<String, Object>>) out.get("months")).get(0);

        assertEquals(20000L, sep.get("expenses"));
        assertEquals(1, ((List<?>) sep.get("expenseLines")).size(), "the unaccounted line is not listed");
        assertEquals(5000L, sep.get("earned"));
    }

    @Test
    void aLossMonthGivesNoShareButTheCutStillComesOff() {
        month(15000, expense(20000, "Feed", "CATTLE"));

        Map<?, ?> row = (Map<?, ?>) ((List<?>) service.calculate("2026-10").get("rows")).get(0);

        assertEquals(0L, row.get("earned"));
        assertEquals(-3611L, row.get("payable"));
    }

    @Test
    void fixedSalaryIgnoresProfit() {
        lokesh.setType("FIXED");
        lokesh.setFixedAmount(12000.0);
        month(0);

        Map<?, ?> row = (Map<?, ?>) ((List<?>) service.calculate("2026-10").get("rows")).get(0);

        assertEquals(12000L, row.get("earned"));
        assertEquals(12000L - 3611L, row.get("payable"));
    }

    @Test
    void theCutsAddUpToTheAdvanceExactly() {
        List<AdvanceSchedule.Month> rows = AdvanceSchedule.build(advances, YearMonth.of(2026, 10));

        assertEquals(18, rows.size());
        assertEquals(65000, rows.stream().mapToLong(AdvanceSchedule.Month::cut).sum());
        assertEquals(0, rows.get(17).left());
        assertEquals(0, AdvanceSchedule.at(rows, YearMonth.of(2028, 4)).left(), "after the last cut");
        assertEquals(0, AdvanceSchedule.at(rows, YearMonth.of(2026, 9)).left(), "before it was given");
    }

    @Test
    @SuppressWarnings("unchecked")
    void showsGivenRecoveredAndLeftUpToTheMonth() {
        Map<String, Object> totals = (Map<String, Object>) service.advances(7L, "2026-12").get("totals");

        assertEquals(65000L, totals.get("given"));
        assertEquals(3 * 3611L, totals.get("recovered"), "Oct, Nov and Dec cuts");
        assertEquals(65000L - 3 * 3611L, totals.get("left"));
        assertEquals(15L, totals.get("monthsLeft"));
    }

    @Test
    void payingTheBalanceInFullStopsTheCuts() {
        advances.add(repaid("2027-01-10", 65000 - 3 * 3611));

        List<AdvanceSchedule.Month> rows = AdvanceSchedule.build(advances, YearMonth.of(2027, 1));
        AdvanceSchedule.Month jan = AdvanceSchedule.at(rows, YearMonth.of(2027, 1));

        assertEquals(65000 - 3 * 3611, jan.repaid());
        assertEquals(0, jan.cut(), "nothing left to cut");
        assertEquals(0, jan.left());
        assertTrue(rows.stream().filter(r -> r.month().isAfter(YearMonth.of(2027, 1))).allMatch(r -> r.cut() == 0));
    }

    @Test
    void aPartRepaymentEndsTheCutsSooner() {
        advances.add(repaid("2026-11-15", 20000));

        List<AdvanceSchedule.Month> rows = AdvanceSchedule.build(advances, YearMonth.of(2026, 11));

        assertEquals(65000, rows.stream().mapToLong(r -> r.cut() + r.repaid()).sum(), "every rupee comes back once");
        long cutMonths = rows.stream().filter(r -> r.cut() > 0).count();
        assertTrue(cutMonths < 18, "ends before the 18 planned months");
        assertEquals(0, rows.get(rows.size() - 1).left());
    }

    @Test
    void aSecondAdvanceAddsItsOwnInstalments() {
        advances.add(given("2027-02-01", 12000, 6, "2027-03"));

        List<AdvanceSchedule.Month> rows = AdvanceSchedule.build(advances, YearMonth.of(2027, 3));
        AdvanceSchedule.Month march = AdvanceSchedule.at(rows, YearMonth.of(2027, 3));

        assertEquals(3611 + 2000, march.cut());
        assertEquals(77000, rows.stream().mapToLong(AdvanceSchedule.Month::cut).sum());
    }

    @Test
    void aRepaymentCannotBeMoreThanIsOwed() {
        assertThrows(IllegalArgumentException.class, () ->
            service.addAdvance(7L, Map.of("type", "REPAID", "date", "2026-11-10", "amount", 70000)));
        assertThrows(IllegalArgumentException.class, () ->
            service.addAdvance(7L, Map.of("type", "GIVEN", "date", "2026-11-10", "amount", 5000, "terms", 5, "startMonth", "2026-10")),
            "cuts cannot start before the advance was given");
    }

    private static Income income(String date, double amount, String category) {
        Income i = new Income();
        i.setDate(LocalDate.parse(date));
        i.setAmount(amount);
        i.setCategory(category);
        return i;
    }

    private static Income poultryIncome(String date, double amount) {
        Income i = income(date, amount, "EGGS");
        i.setSegment("POULTRY");
        return i;
    }

    private static Expense expenseOn(String date, double amount, String category, String segment) {
        Expense e = expense(amount, category, segment);
        e.setDate(LocalDate.parse(date));
        return e;
    }

    private static BankTransaction bankLine(String date, double amount, String narration, String kind, String category) {
        BankTransaction t = new BankTransaction();
        t.setTxnDate(LocalDate.parse(date));
        t.setAmount(amount);
        t.setNarration(narration);
        t.setDirection("DEBIT");
        t.setStatus("MAPPED");
        t.setKind(kind);
        t.setCategory(category);
        return t;
    }

    @Test
    void breakdownWorksEachMonthOutFromTheFarmRecords() {
        lokesh.setBankName("LOKESH G");
        when(incomeRepository.findByDateBetween(any(), any())).thenReturn(List.of(
            income("2026-09-03", 30000, "MILK_SALES"), income("2026-09-20", 16991, "MILK_SALES"),
            income("2026-09-21", 5000, "MANURE"),               // other income counts, as on the ledger card
            poultryIncome("2026-09-22", 7000),                  // poultry: left out
            income("2026-10-05", 49133, "MILK_SALES"),
            income("2026-11-02", 6398, "MILK_SALES")));
        when(expenseRepository.findByDateBetween(any(), any())).thenReturn(List.of(
            expenseOn("2026-09-10", 27805, "Feed", null),
            expenseOn("2026-09-11", 3000, "Poultry", "POULTRY"),  // poultry: left out
            expenseOn("2026-10-10", 9045, "Feed", "CATTLE"),
            expenseOn("2026-11-01", 53934, "Feed", null)));
        when(bankRepository.findByTxnDateBetweenOrderByTxnDateDescIdDesc(any(), any())).thenReturn(List.of(
            bankLine("2026-10-06", 20000, "MB: Sent NEFT/ LOKESH G", "EXPENSE", "Salary"),             // September's salary
            bankLine("2026-11-07", 9000, "MB: Sent NEFT/ LOKESH G", "EXPENSE", "Salary"),              // October's salary
            bankLine("2026-11-19", 4000, "MB: Sent NEFT/ LOKESH G", "SETTLEMENT", "STAFF_REIMBURSEMENT"), // not salary
            bankLine("2026-11-20", 2000, "MB: Sent NEFT/ RAVI", "EXPENSE", "Salary")));                  // someone else

        Map<String, Object> out = service.breakdown(7L, "2026-09", "2026-11", YearMonth.of(2026, 11));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> months = (List<Map<String, Object>>) out.get("months");

        assertEquals(List.of("2026-11", "2026-10", "2026-09"), months.stream().map(m -> m.get("month")).toList(), "newest first");
        Map<String, Object> sep = months.get(2), oct = months.get(1), nov = months.get(0);
        assertEquals(51991L, sep.get("estIncome"));
        assertEquals(27805L, sep.get("expenses"));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> sepLines = (List<Map<String, Object>>) sep.get("expenseLines");
        assertEquals(1, sepLines.size(), "the poultry expense is not listed");
        assertEquals(27805L, sepLines.get(0).get("amount"));
        assertEquals("Feed", sepLines.get(0).get("category"));
        assertEquals(12093L, sep.get("earned"));                // (51,991 - 27,805) x 50%
        assertEquals(0L, sep.get("advanceCut"), "no cut before the advance's first month");
        assertEquals(20000L, sep.get("paidByBank"), "paid in October, for September");
        assertEquals("2026-10", sep.get("payMonth"));
        assertEquals(20044L, oct.get("earned"));                // (49,133 - 9,045) x 50%
        assertEquals(3611L, oct.get("advanceCut"));
        assertEquals(20044L - 3611L, oct.get("payable"));
        assertEquals(9000L, oct.get("paidByBank"));
        assertEquals(20044L - 3611L - 9000L, oct.get("balance"));
        assertEquals(-47536L, nov.get("profit"));
        assertEquals(0L, nov.get("earned"), "a loss gives no share");
        assertEquals(-3611L, nov.get("payable"), "the cut still comes off");
        assertEquals(true, nov.get("current"));

        @SuppressWarnings("unchecked")
        Map<String, Object> totals = (Map<String, Object>) out.get("totals");
        assertEquals("2026-10", totals.get("upTo"), "the month still running is not in the totals");
        assertEquals(12093L + 20044L, totals.get("earned"));
        assertEquals(3611L, totals.get("advanceCut"));
        assertEquals(29000L, totals.get("paidByBank"));
        assertEquals(65000L - 3611L, totals.get("advanceLeft"));
    }

    @Test
    void breakdownRejectsABackwardsRange() {
        assertThrows(IllegalArgumentException.class, () -> service.breakdown(7L, "2026-11", "2026-09"));
    }

    private static Map<String, Object> cut(String month, long amount) {
        return Map.of("month", month, "amount", amount);
    }

    @Test
    void anAdvanceCanHaveADifferentCutEachMonth() {
        advances.clear();
        service.addAdvance(7L, Map.of("type", "GIVEN", "date", "2026-10-05", "amount", 10000, "mode", "CASH",
            "plan", List.of(cut("2026-10", 3000), cut("2026-11", 0), cut("2026-12", 7000))));

        List<AdvanceSchedule.Month> rows = AdvanceSchedule.build(advances, YearMonth.of(2026, 12));
        assertEquals(3000, AdvanceSchedule.at(rows, YearMonth.of(2026, 10)).cut());
        assertEquals(0, AdvanceSchedule.at(rows, YearMonth.of(2026, 11)).cut(), "0 skips the month");
        assertEquals(7000, AdvanceSchedule.at(rows, YearMonth.of(2026, 12)).cut());
        assertEquals(0, AdvanceSchedule.at(rows, YearMonth.of(2026, 12)).left());
        SalaryAdvance saved = advances.get(0);
        assertEquals("2026-10", saved.getStartMonth());
        assertEquals(3, saved.getTerms());
    }

    @Test
    void thePlanMustAddUpToTheAdvance() {
        advances.clear();
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
            service.addAdvance(7L, Map.of("type", "GIVEN", "date", "2026-10-05", "amount", 10000,
                "plan", List.of(cut("2026-10", 3000), cut("2026-11", 5000)))));
        assertTrue(ex.getMessage().contains("2000 more to plan"), ex.getMessage());
        assertThrows(IllegalArgumentException.class, () ->
            service.addAdvance(7L, Map.of("type", "GIVEN", "date", "2026-10-05", "amount", 10000,
                "plan", List.of(cut("2026-09", 10000)))), "no cut before the advance was given");
    }

    @Test
    void anAdvanceCanBeChangedLater() {
        SalaryAdvance first = advances.get(0); // 65,000 over 18 months from Oct 2026, no saved plan
        first.setId(1L);
        when(advanceRepository.findById(1L)).thenReturn(Optional.of(first));
        Map<String, Object> plan = new LinkedHashMap<>();

        // start a month earlier, take 10,000 in Sep and the rest evenly in the 17 months after
        List<Map<String, Object>> cuts = new ArrayList<>();
        cuts.add(cut("2026-09", 10000));
        for (int i = 1; i <= 17; i++) cuts.add(cut(YearMonth.of(2026, 9).plusMonths(i).toString(), i == 17 ? 55000 - 3235L * 16 : 3235));
        plan.put("date", "2026-09-01");
        plan.put("amount", 65000);
        plan.put("mode", "CASH");
        plan.put("plan", cuts);
        service.updateAdvance(7L, 1L, plan);

        assertEquals("2026-09", first.getStartMonth());
        assertEquals(LocalDate.parse("2026-09-01"), first.getDate());
        List<AdvanceSchedule.Month> rows = AdvanceSchedule.build(advances, YearMonth.of(2026, 10));
        assertEquals(10000, AdvanceSchedule.at(rows, YearMonth.of(2026, 9)).cut());
        assertEquals(3235, AdvanceSchedule.at(rows, YearMonth.of(2026, 10)).cut());
        assertEquals(65000, rows.stream().mapToLong(AdvanceSchedule.Month::cut).sum());

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> entries = (List<Map<String, Object>>) service.advances(7L, "2026-10").get("entries");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> shown = (List<Map<String, Object>>) entries.get(0).get("plan");
        assertEquals(18, shown.size());
        assertNull(entries.get(0).get("monthlyCut"), "cuts differ, so no single monthly figure");
    }
}
