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
    @Mock private IncomeService incomeService;
    @Mock private SalaryAdvanceRepository advanceRepository;

    private SalaryRuleService service;
    private SalaryRule lokesh;
    private final List<SalaryAdvance> advances = new ArrayList<>();

    @BeforeEach
    void setUp() {
        service = new SalaryRuleService();
        ReflectionTestUtils.setField(service, "ruleRepository", ruleRepository);
        ReflectionTestUtils.setField(service, "staffRepository", staffRepository);
        ReflectionTestUtils.setField(service, "expenseRepository", expenseRepository);
        ReflectionTestUtils.setField(service, "incomeService", incomeService);
        ReflectionTestUtils.setField(service, "advanceRepository", advanceRepository);

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
        when(advanceRepository.save(any())).thenAnswer(inv -> { advances.add(inv.getArgument(0)); return inv.getArgument(0); });
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

    private void month(double milkReceived, Expense... expenses) {
        when(incomeService.getMilkReceivedByMonth())
            .thenReturn(List.of(Map.of("month", "2026-10", "received", milkReceived, "pending", 0.0, "payments", 1)));
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
}
