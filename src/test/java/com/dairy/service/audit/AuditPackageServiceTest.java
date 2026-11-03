package com.dairy.service.audit;

import com.dairy.model.Expense;
import com.dairy.model.audit.AuditPackage;
import com.dairy.model.audit.AuditPackageExpense;
import com.dairy.model.bank.BankTransaction;
import com.dairy.repo.ExpenseRepository;
import com.dairy.repo.SaleRepository;
import com.dairy.repo.audit.AuditPackageAttachmentRepository;
import com.dairy.repo.audit.AuditPackageExpenseRepository;
import com.dairy.repo.audit.AuditPackageRepository;
import com.dairy.repo.bank.BankStatementFileRepository;
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
import java.time.YearMonth;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * The purchase register must hold each rupee once: cash expenses are the ledger expenses no bank
 * line paid, and the bank reconciliation must add up from the statement's own balances.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AuditPackageServiceTest {

    private static final YearMonth OCT = YearMonth.of(2026, 10);

    @Mock private AuditPackageRepository packageRepository;
    @Mock private AuditPackageExpenseRepository lineRepository;
    @Mock private AuditPackageAttachmentRepository attachmentRepository;
    @Mock private ExpenseRepository expenseRepository;
    @Mock private SaleRepository saleRepository;
    @Mock private BankTransactionRepository bankRepository;
    @Mock private BankStatementFileRepository statementRepository;

    private AuditPackageService service;
    private final List<AuditPackageExpense> lines = new ArrayList<>();
    private final List<Expense> ledger = new ArrayList<>();
    private final Set<Long> bankPaid = new HashSet<>();
    private final List<BankTransaction> bank = new ArrayList<>();

    @BeforeEach
    void setUp() {
        service = new AuditPackageService();
        for (String f : List.of("packageRepository", "expenseLineRepository", "attachmentRepository", "expenseRepository",
            "saleRepository", "bankRepository", "statementRepository")) {
            Object mock = switch (f) {
                case "packageRepository" -> packageRepository;
                case "expenseLineRepository" -> lineRepository;
                case "attachmentRepository" -> attachmentRepository;
                case "expenseRepository" -> expenseRepository;
                case "saleRepository" -> saleRepository;
                case "bankRepository" -> bankRepository;
                default -> statementRepository;
            };
            ReflectionTestUtils.setField(service, f, mock);
        }
        when(packageRepository.findByPeriodFrom(any())).thenReturn(Optional.empty());
        when(packageRepository.save(any())).thenAnswer(inv -> {
            AuditPackage p = inv.getArgument(0);
            if (p.getId() == null) p.setId(1L);
            return p;
        });
        when(lineRepository.findByPackageIdOrderByDateAscIdAsc(1L)).thenReturn(lines);
        when(lineRepository.save(any())).thenAnswer(inv -> {
            AuditPackageExpense l = inv.getArgument(0);
            if (!lines.contains(l)) { l.setId((long) lines.size() + 100); lines.add(l); }
            return l;
        });
        when(expenseRepository.findByDateBetween(any(), any())).thenReturn(ledger);
        when(bankRepository.findLedgerIdsByKind("EXPENSE")).thenReturn(bankPaid);
        when(bankRepository.findByTxnDateBetweenOrderByTxnDateDescIdDesc(any(), any())).thenReturn(bank);
        when(saleRepository.findByPaymentStatus(anyString())).thenReturn(List.of());
        when(attachmentRepository.listMeta(any())).thenReturn(List.of());
    }

    private Expense expense(long id, String category, double amount, String paidBy) {
        Expense e = new Expense();
        e.setId(id);
        e.setCategory(category);
        e.setAmount(amount);
        e.setDate(LocalDate.of(2026, 10, 10));
        e.setPaidBy(paidBy);
        ledger.add(e);
        return e;
    }

    @Test
    @SuppressWarnings("unchecked")
    void cashExpensesAreTheLedgerExpensesNoBankLinePaid() {
        expense(1, "Feed", 2265, "Lokesh");
        expense(2, "Doctor Fee", 850, null);
        expense(3, "Electricity", 4000, null);
        bankPaid.add(3L); // paid through Kotak, already in the register from the bank side

        Map<String, Object> view = service.open(OCT);

        List<Map<String, Object>> cash = (List<Map<String, Object>>) view.get("cashExpenses");
        assertEquals(List.of(1L, 2L), cash.stream().map(m -> m.get("ledgerExpenseId")).toList());
        List<Map<String, Object>> addable = (List<Map<String, Object>>) view.get("ledgerExpenses");
        assertEquals(1, addable.size());
        assertEquals(true, addable.get(0).get("paidThroughBank"));
    }

    @Test
    void checkingTheLedgerAgainTakesOutLinesABankPaymentNowCoversAndKeepsRemovedOnesOut() {
        expense(1, "Feed", 2265, "Lokesh");
        expense(2, "Doctor Fee", 850, null);
        service.open(OCT);
        AuditPackage p = new AuditPackage();
        p.setId(1L);
        p.setPeriodFrom(OCT.atDay(1));
        p.setPeriodTo(OCT.atEndOfMonth());
        when(packageRepository.findById(1L)).thenReturn(Optional.of(p));
        lines.get(1).setExcluded(true);            // someone removed the doctor's fee
        bankPaid.add(1L);                          // the feed bill was then matched to a bank payment
        expense(4, "Labours", 1000, null);         // and a new cash expense was entered

        service.refresh(1L);

        assertTrue(lines.get(0).isExcluded(), "now paid through the bank");
        assertTrue(lines.get(1).isExcluded(), "a removed line is not re-added");
        assertEquals(3, lines.size());
        assertEquals(4L, lines.get(2).getLedgerExpenseId());
    }

    @Test
    @SuppressWarnings("unchecked")
    void reconciliationRunsFromTheStatementsOwnBalances() {
        bank.add(txn(2, "2026-10-06", "DEBIT", 20000, 175137.12));
        bank.add(txn(1, "2026-10-05", "CREDIT", 22900, 195137.12));
        bank.add(txn(3, "2026-10-28", "DEBIT", 5.90, 175131.22));

        Map<String, Object> b = (Map<String, Object>) service.open(OCT).get("bank");

        assertEquals(172237.12, (double) b.get("openingBalance"), 0.001);
        assertEquals(22900.0, (double) b.get("receipts"), 0.001);
        assertEquals(20005.90, (double) b.get("payments"), 0.001);
        assertEquals(175131.22, (double) b.get("closingBalance"), 0.001);
    }

    private static BankTransaction txn(long id, String date, String dir, double amount, double balance) {
        BankTransaction t = new BankTransaction();
        t.setId(id);
        t.setTxnDate(LocalDate.parse(date));
        t.setDirection(dir);
        t.setAmount(amount);
        t.setBalance(balance);
        t.setStatus("UNMAPPED");
        return t;
    }

    @Test
    void correctingAManualLineMarksItReviewedAndLeavesTheLedgerAlone() {
        expense(1, "Feed", 5000, "Srinivas");
        service.open(OCT);
        AuditPackage p = new AuditPackage();
        p.setId(1L);
        p.setPeriodFrom(OCT.atDay(1));
        p.setPeriodTo(OCT.atEndOfMonth());
        when(packageRepository.findById(1L)).thenReturn(Optional.of(p));
        AuditPackageExpense line = lines.get(0);
        when(lineRepository.findById(line.getId())).thenReturn(Optional.of(line));
        assertFalse(line.isReviewed(), "manual lines start as to review");

        service.updateExpense(1L, line.getId(), Map.of("amount", 4500, "category", "Cattle feed"));

        assertEquals(4500.0, line.getAmount());
        assertEquals("Cattle feed", line.getCategory());
        assertTrue(line.isEdited());
        assertTrue(line.isReviewed());
        verify(expenseRepository, never()).save(any());
        assertThrows(IllegalArgumentException.class,
            () -> service.updateExpense(1L, line.getId(), Map.of("date", "2026-11-02")), "outside the month");
    }

    @Test
    @SuppressWarnings("unchecked")
    void salesAreWhatReachedTheBankNotTheAppsMilkEstimates() {
        BankTransaction gopal = txn(8, "2026-10-05", "CREDIT", 22900, 195137.12);
        gopal.setStatus("MAPPED");
        gopal.setKind("SETTLEMENT");
        gopal.setCategory("MILK_SALES");
        gopal.setCounterparty("GOPAL RAMASWAMI REDDY");
        bank.add(gopal);
        BankTransaction open = txn(9, "2026-10-20", "CREDIT", 5000, 200137.12);
        bank.add(open); // not reviewed yet
        BankTransaction own = txn(10, "2026-10-21", "CREDIT", 1000, 201137.12);
        own.setStatus("IGNORED");
        bank.add(own);

        Map<String, Object> sales = (Map<String, Object>) service.open(OCT).get("sales");

        List<Map<String, Object>> byCategory = (List<Map<String, Object>>) sales.get("byCategory");
        assertEquals(1, byCategory.size());
        assertEquals("MILK_SALES", byCategory.get(0).get("category"));
        assertEquals(22900.0, (double) byCategory.get(0).get("amount"), 0.001);
        assertEquals(1, ((List<?>) sales.get("receipts")).size());
        assertEquals(1, sales.get("unreviewedCount"));
        assertEquals(5000.0, (double) sales.get("unreviewedAmount"), 0.001);
        // the app's own sale records are not read for sales (receivables still read the unpaid ones)
        verify(saleRepository, never()).findByDateBetween(any(), any());
    }
}
