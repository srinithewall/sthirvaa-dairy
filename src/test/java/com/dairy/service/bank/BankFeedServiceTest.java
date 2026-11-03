package com.dairy.service.bank;

import com.dairy.model.Category;
import com.dairy.model.Expense;
import com.dairy.model.bank.BankRule;
import com.dairy.model.bank.BankTransaction;
import com.dairy.repo.CategoryRepository;
import com.dairy.repo.ExpenseRepository;
import com.dairy.repo.IncomeRepository;
import com.dairy.repo.bank.BankRuleRepository;
import com.dairy.repo.bank.BankTransactionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.*;

/**
 * Each fetched line must land in exactly one place: linked to a ledger entry someone already made,
 * posted by a learned rule, suggested from its narration, or left for review - never booked twice.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class BankFeedServiceTest {

    private static final LocalDate DAY = LocalDate.of(2026, 10, 10);

    @Mock private KotakClient kotakClient;
    @Mock private BankTransactionRepository txnRepository;
    @Mock private BankRuleRepository ruleRepository;
    @Mock private ExpenseRepository expenseRepository;
    @Mock private IncomeRepository incomeRepository;
    @Mock private CategoryRepository categoryRepository;

    private BankFeedService service;
    private final List<BankTransaction> saved = new ArrayList<>();
    private final List<Expense> expenses = new ArrayList<>();
    private final List<BankRule> rules = new ArrayList<>();

    @BeforeEach
    void setUp() {
        service = new BankFeedService();
        ReflectionTestUtils.setField(service, "kotakClient", kotakClient);
        ReflectionTestUtils.setField(service, "txnRepository", txnRepository);
        ReflectionTestUtils.setField(service, "ruleRepository", ruleRepository);
        ReflectionTestUtils.setField(service, "expenseRepository", expenseRepository);
        ReflectionTestUtils.setField(service, "incomeRepository", incomeRepository);
        ReflectionTestUtils.setField(service, "categoryRepository", categoryRepository);

        when(txnRepository.findExistingKeys(anyCollection())).thenReturn(Set.of());
        when(txnRepository.findLedgerIdsByKind(anyString())).thenReturn(Set.of());
        when(txnRepository.save(any())).thenAnswer(inv -> { saved.add(inv.getArgument(0)); return inv.getArgument(0); });
        when(expenseRepository.findByDateBetween(any(), any())).thenReturn(expenses);
        when(incomeRepository.findByDateBetween(any(), any())).thenReturn(List.of());
        when(expenseRepository.save(any())).thenAnswer(inv -> { Expense e = inv.getArgument(0); e.setId(900L); return e; });
        when(ruleRepository.findAll()).thenReturn(rules);
        when(categoryRepository.findAll()).thenReturn(List.of(
            new Category("Cattle Feed", Category.CategoryType.EXPENSE, "🌾"),
            new Category("Staff Salary", Category.CategoryType.EXPENSE, "👷")));
    }

    private static KotakClient.StatementLine debit(String narration, double amount, LocalDate date) {
        return new KotakClient.StatementLine(null, date, narration, amount, false, null);
    }

    @Test
    void linksAnEntryAlreadyInTheLedgerInsteadOfPostingAgain() {
        Expense manual = new Expense();
        manual.setId(42L);
        manual.setCategory("Medical");
        manual.setAmount(4500.0);
        manual.setDate(DAY.minusDays(2));
        expenses.add(manual);

        service.importLines(List.of(debit("UPI/SRI VET CLINIC/412345678901/vet", 4500, DAY)));

        BankTransaction t = saved.get(0);
        assertEquals("MAPPED", t.getStatus());
        assertEquals(42L, t.getLedgerId());
        assertFalse(t.isPosted());
        assertEquals("Medical", t.getCategory());
        verify(expenseRepository, never()).save(any());
    }

    @Test
    void ledgerEntriesFurtherThanThreeDaysAwayAreNotTheSamePayment() {
        Expense old = new Expense();
        old.setId(42L);
        old.setCategory("Medical");
        old.setAmount(4500.0);
        old.setDate(DAY.minusDays(10));
        expenses.add(old);

        service.importLines(List.of(debit("UPI/SOMEONE NEW/412345678901/x", 4500, DAY)));

        assertEquals("UNMAPPED", saved.get(0).getStatus());
    }

    @Test
    void aLearnedRuleBooksTheExpenseOnTheBankSideOnly() {
        BankRule rule = new BankRule();
        rule.setId(7L);
        rule.setPattern("RAMESH FEEDS");
        rule.setDirection("DEBIT");
        rule.setKind("EXPENSE");
        rule.setCategory("Cattle Feed");
        rule.setSegment("CATTLE");
        rules.add(rule);

        service.importLines(List.of(debit("NEFT-HDFCN52026101012345-RAMESH FEEDS-KARNATAKA", 18250, DAY)));

        BankTransaction t = saved.get(0);
        assertEquals("MAPPED", t.getStatus());
        assertEquals("EXPENSE", t.getKind());
        assertEquals("Cattle Feed", t.getCategory());
        assertFalse(t.isPosted());
        assertNull(t.getLedgerId());
        assertEquals(1, rule.getHits());
        verify(expenseRepository, never()).save(any()); // the Digital Ledger is only what staff enter
    }

    @Test
    void societyMilkPaymentIsSuggestedAsASettlementNotNewIncome() {
        service.importLines(List.of(new KotakClient.StatementLine("UTR1", DAY, "NEFT INW-BAMUL BANGALORE-MILK BILL",
            62340, true, null)));

        BankTransaction t = saved.get(0);
        assertEquals("SUGGESTED", t.getStatus());
        assertEquals("SETTLEMENT", t.getKind());
        assertEquals("MILK_SALES", t.getCategory());
        verify(incomeRepository, never()).save(any());
    }

    @Test
    void narrationKeywordsAreSuggestedAgainstTheLedgersOwnCategories() {
        service.importLines(List.of(debit("IMPS-412345678-SALARY OCT-RAJU", 12000, DAY)));

        BankTransaction t = saved.get(0);
        assertEquals("SUGGESTED", t.getStatus());
        assertEquals("Staff Salary", t.getCategory());
        verify(expenseRepository, never()).save(any());
    }

    @Test
    void linesAlreadyFetchedAreSkipped() {
        KotakClient.StatementLine line = debit("UPI/X/1/y", 10, DAY);
        when(txnRepository.findExistingKeys(anyCollection())).thenReturn(Set.of(BankFeedService.dedupeKey(line)));

        Map<String, Object> summary = service.importLines(List.of(line, line));

        assertEquals(0, summary.get("new"));
        assertTrue(saved.isEmpty());
    }

    @Test
    void readsTheOtherPartyFromCommonNarrations() {
        assertEquals("RAMESH FEEDS", BankFeedService.counterpartyOf("UPI/RAMESH FEEDS/412345678901/Payment"));
        assertEquals("BAMUL BANGALORE", BankFeedService.counterpartyOf("NEFT INW-HDFCN52026110512345-BAMUL BANGALORE-MILK"));
        assertEquals("RAJU", BankFeedService.counterpartyOf("IMPS 412345678 RAJU"));
        assertNull(BankFeedService.counterpartyOf("12345678/0000"));
        assertEquals("UPI", BankFeedService.modeOf("UPI/RAMESH/1"));
        assertEquals("NEFT", BankFeedService.modeOf("NEFT INW-X"));
    }

    @Test
    void rulesMatchTheWordsOfANameHoweverKotakWritesIt() {
        assertTrue(BankFeedService.matches("NEFT KS00226278144969 GOPAL  S O RAMASWAMI REDDY", "GOPAL RAMASWAMI REDDY"));
        assertTrue(BankFeedService.matches("SentIMPS629208547469LOKESH G/CNRBX0758/KKBKTrans", "LOKESH G"));
        assertFalse(BankFeedService.matches("MB: Sent NEFT/ RAMESH K/ CANARA", "LOKESH"));
        assertFalse(BankFeedService.matches("anything", "  "));
    }

    @Test
    void anEmployeesPaymentWaitsForAChoiceEvenWhenALedgerEntryHasTheSameAmount() {
        BankRule employee = new BankRule();
        employee.setId(9L);
        employee.setPattern("LOKESH");
        employee.setDirection("ANY");
        employee.setKind("EMPLOYEE");
        rules.add(employee);
        Expense feed = new Expense();
        feed.setId(42L);
        feed.setCategory("Feed");
        feed.setAmount(2645.0);
        feed.setDate(DAY);
        expenses.add(feed);

        service.importLines(List.of(debit("MB: Sent NEFT/ LOKESH G/ CANARA / 059812700075", 2645, DAY)));

        BankTransaction t = saved.get(0);
        assertEquals("UNMAPPED", t.getStatus());
        assertNull(t.getLedgerId(), "not linked to the feed bill");
        assertEquals("LOKESH", t.getEmployee());
        assertEquals(9L, t.getRuleId());
        verify(expenseRepository, never()).save(any());
    }
}
