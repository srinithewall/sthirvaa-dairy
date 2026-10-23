package com.dairy.service;

import com.dairy.model.AmcsCollection;
import com.dairy.model.Customer;
import com.dairy.model.Income;
import com.dairy.model.MilkDispatch;
import com.dairy.repo.AmcsCollectionRepository;
import com.dairy.repo.CustomerRepository;
import com.dairy.repo.IncomeRepository;
import com.dairy.repo.MilkDispatchRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * AMCS imports must be idempotent (the sync re-sends overlapping date ranges) and must keep one
 * KMF dispatch per date+shift whose litres and amount match AMCS's own totals.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AmcsCollectionServiceTest {

    private static final LocalDate DAY = LocalDate.of(2026, 10, 1);

    @Mock private AmcsCollectionRepository collectionRepository;
    @Mock private MilkDispatchRepository dispatchRepository;
    @Mock private CustomerRepository customerRepository;
    @Mock private IncomeRepository incomeRepository;

    private AmcsCollectionService service;
    private Customer kmf;
    private final List<AmcsCollection> stored = new ArrayList<>();

    @BeforeEach
    void setUp() {
        service = new AmcsCollectionService();
        ReflectionTestUtils.setField(service, "collectionRepository", collectionRepository);
        ReflectionTestUtils.setField(service, "dispatchRepository", dispatchRepository);
        ReflectionTestUtils.setField(service, "customerRepository", customerRepository);
        ReflectionTestUtils.setField(service, "incomeRepository", incomeRepository);
        ReflectionTestUtils.setField(service, "customerName", "KMF Nandini (AMCS)");

        kmf = new Customer();
        kmf.setId(7L);
        kmf.setName("KMF Nandini (AMCS)");
        when(customerRepository.findFirstByNameIgnoreCase(anyString())).thenReturn(Optional.of(kmf));

        // A tiny in-memory collection table keyed like the unique constraint
        when(collectionRepository.findByMemberCodeAndDateAndShiftAndSampleNo(anyString(), any(), anyString(), anyInt()))
            .thenAnswer(inv -> stored.stream()
                .filter(c -> c.getMemberCode().equals(inv.getArgument(0))
                    && c.getDate().equals(inv.getArgument(1))
                    && c.getShift().equals(inv.getArgument(2))
                    && c.getSampleNo().equals(inv.getArgument(3)))
                .findFirst());
        when(collectionRepository.save(any(AmcsCollection.class))).thenAnswer(inv -> {
            AmcsCollection c = inv.getArgument(0);
            if (!stored.contains(c)) stored.add(c);
            return c;
        });
        when(collectionRepository.findByDateAndShift(any(), anyString())).thenAnswer(inv -> stored.stream()
            .filter(c -> c.getDate().equals(inv.getArgument(0)) && c.getShift().equals(inv.getArgument(1)))
            .toList());

        when(dispatchRepository.findByDateAndShift(any(), anyString())).thenReturn(new ArrayList<>());
        when(dispatchRepository.findByDate(any())).thenReturn(new ArrayList<>());
        when(incomeRepository.findByCategoryAndDate(anyString(), any())).thenReturn(Optional.empty());
    }

    private static Map<String, Object> row(String when, String shift, int sampleNo, double qty, double amount) {
        Map<String, Object> r = new HashMap<>();
        r.put("memberCode", "05401290327");
        r.put("collectionDate", when);
        r.put("shiftCode", shift);
        r.put("sampleNo", sampleNo);
        r.put("quantity", qty);
        r.put("amount", amount);
        r.put("fat", 3);
        r.put("snf", 8.5);
        r.put("clr", 29.6);
        r.put("rate", 32.5);
        r.put("animalTypeName", "Cow");
        r.put("isQualityAuto", true);
        r.put("isQuantityAuto", true);
        return r;
    }

    @Test
    void newRowsAreInsertedAndDispatchedPerShift() {
        Map<String, Object> out = service.importRows(List.of(
            row("2026-10-01 06:00:00.000000", "Morning", 22, 23.4, 760.5),
            row("2026-10-01 16:00:00.000000", "Evening", 29, 20.2, 656.5)));

        assertEquals(2, out.get("inserted"));
        assertEquals(0, out.get("updated"));
        assertEquals(2, out.get("shiftsSynced"));

        ArgumentCaptor<MilkDispatch> dispatches = ArgumentCaptor.forClass(MilkDispatch.class);
        verify(dispatchRepository, org.mockito.Mockito.times(2)).save(dispatches.capture());
        MilkDispatch morning = dispatches.getAllValues().get(0);
        assertEquals("MORNING", morning.getShift());
        assertEquals("CUSTOMER", morning.getDispatchType());
        assertEquals(7L, morning.getCustomer().getId());
        assertEquals(23.4, morning.getQuantity(), 1e-9);
        assertEquals(760.5, morning.getTotalAmount(), 1e-9);
        assertEquals(32.5, morning.getRatePerLitre(), 1e-9);

        ArgumentCaptor<Income> income = ArgumentCaptor.forClass(Income.class);
        verify(incomeRepository).save(income.capture());
        assertEquals("MILK_SALES", income.getValue().getCategory());
        assertEquals(DAY, income.getValue().getDate());
    }

    @Test
    void reimportingTheSameRowsDoesNotRewriteThem() {
        List<Map<String, Object>> rows = List.of(row("2026-10-01 06:00:00.000000", "Morning", 22, 23.4, 760.5));
        service.importRows(rows);
        Map<String, Object> second = service.importRows(rows);

        assertEquals(0, second.get("inserted"));
        assertEquals(0, second.get("updated"));
        assertEquals(1, second.get("unchanged"));
        assertEquals(1, stored.size());
        verify(collectionRepository, org.mockito.Mockito.times(1)).save(any(AmcsCollection.class));
    }

    @Test
    void correctedRowIsUpdatedInPlace() {
        service.importRows(List.of(row("2026-10-01 06:00:00.000000", "Morning", 22, 23.4, 760.5)));
        Map<String, Object> out = service.importRows(List.of(row("2026-10-01 06:00:00.000000", "Morning", 22, 24.0, 780.0)));

        assertEquals(1, out.get("updated"));
        assertEquals(1, stored.size());
        assertEquals(24.0, stored.get(0).getQuantity(), 1e-9);
    }

    @Test
    void dispatchIsRecreatedEvenWhenAllRowsAreUnchanged() {
        List<Map<String, Object>> rows = List.of(row("2026-10-01 06:00:00.000000", "Morning", 22, 23.4, 760.5));
        service.importRows(rows);
        service.importRows(rows);

        // Both runs write the dispatch: it may have been wiped by the dispatch screen in between
        verify(dispatchRepository, org.mockito.Mockito.times(2)).save(any(MilkDispatch.class));
    }

    @Test
    void severalPoursInOneShiftAreSummedIntoOneDispatch() {
        service.importRows(List.of(
            row("2026-10-01 06:00:00.000000", "Morning", 22, 10.0, 325.0),
            row("2026-10-01 06:00:00.000000", "Morning", 23, 5.0, 170.0)));

        ArgumentCaptor<MilkDispatch> dispatch = ArgumentCaptor.forClass(MilkDispatch.class);
        verify(dispatchRepository).save(dispatch.capture());
        assertEquals(15.0, dispatch.getValue().getQuantity(), 1e-9);
        assertEquals(495.0, dispatch.getValue().getTotalAmount(), 1e-9);
        assertEquals(33.0, dispatch.getValue().getRatePerLitre(), 1e-9);
    }

    @Test
    void theStoredRateIsRoundedToPaiseWhileTheAmountStaysExact() {
        // 1026 / 28 = 36.642857142857...
        service.importRows(List.of(row("2026-10-01 06:00:00.000000", "Morning", 22, 28.0, 1026.0)));

        ArgumentCaptor<MilkDispatch> dispatch = ArgumentCaptor.forClass(MilkDispatch.class);
        verify(dispatchRepository).save(dispatch.capture());
        assertEquals(36.64, dispatch.getValue().getRatePerLitre(), 1e-12);
        assertEquals(1026.0, dispatch.getValue().getTotalAmount(), 1e-9);
    }

    @Test
    void existingKmfDispatchIsUpdatedNotDuplicated() {
        MilkDispatch old = new MilkDispatch();
        old.setDispatchType("CUSTOMER");
        old.setCustomer(kmf);
        old.setQuantity(1.0);
        when(dispatchRepository.findByDateAndShift(eq(DAY), eq("MORNING"))).thenReturn(new ArrayList<>(List.of(old)));

        service.importRows(List.of(row("2026-10-01 06:00:00.000000", "Morning", 22, 23.4, 760.5)));

        verify(dispatchRepository).save(old);
        assertEquals(23.4, old.getQuantity(), 1e-9);
        verify(dispatchRepository, never()).deleteAll(any());
    }

    @Test
    void datesWithHandEnteredCombinedDispatchesForTheSameCustomerAreNotDoubleCounted() {
        MilkDispatch manual = new MilkDispatch();
        manual.setDate(DAY);
        manual.setShift("COMBINED");
        manual.setDispatchType("CUSTOMER");
        manual.setCustomer(kmf);
        manual.setQuantity(23.4);
        when(dispatchRepository.findByDate(eq(DAY))).thenReturn(new ArrayList<>(List.of(manual)));

        Map<String, Object> out = service.importRows(List.of(
            row("2026-10-01 06:00:00.000000", "Morning", 22, 23.4, 760.5),
            row("2026-10-02 06:00:00.000000", "Morning", 20, 25.4, 825.5)));

        // The AMCS rows are kept for both days...
        assertEquals(2, out.get("inserted"));
        assertEquals(2, stored.size());
        // ...but only the day with no manual dispatch gets one, and only that day's income is touched
        assertEquals(1, out.get("shiftsSynced"));
        assertEquals(List.of("2026-10-01"), out.get("datesSkippedManualDispatch"));
        ArgumentCaptor<MilkDispatch> saved = ArgumentCaptor.forClass(MilkDispatch.class);
        verify(dispatchRepository).save(saved.capture());
        assertEquals(LocalDate.of(2026, 10, 2), saved.getValue().getDate());
        ArgumentCaptor<Income> income = ArgumentCaptor.forClass(Income.class);
        verify(incomeRepository).save(income.capture());
        assertEquals(LocalDate.of(2026, 10, 2), income.getValue().getDate());
    }

    @Test
    void otherCustomersDispatchesInTheSameShiftAreLeftAlone() {
        Customer other = new Customer();
        other.setId(99L);
        MilkDispatch theirs = new MilkDispatch();
        theirs.setDispatchType("CUSTOMER");
        theirs.setCustomer(other);
        theirs.setQuantity(5.0);
        when(dispatchRepository.findByDateAndShift(eq(DAY), eq("MORNING"))).thenReturn(new ArrayList<>(List.of(theirs)));

        service.importRows(List.of(row("2026-10-01 06:00:00.000000", "Morning", 22, 23.4, 760.5)));

        assertEquals(5.0, theirs.getQuantity(), 1e-9);
        verify(dispatchRepository, never()).save(theirs);
        verify(dispatchRepository, never()).deleteAll(any());
    }

    @Test
    void supervisorEditsAreCapturedAndManualFlagsDerivedFromAutoFlags() {
        Map<String, Object> r = row("2026-10-01 06:00:00.000000", "Morning", 22, 23.4, 760.5);
        r.put("isQualityAuto", false);
        r.put("updatedBy", "supervisor1");
        r.put("updatedAt", "2026-10-02 08:15:30.000000");

        service.importRows(List.of(r));
        AmcsCollection saved = stored.get(0);

        assertEquals(Boolean.TRUE, saved.getQualityManual());
        assertEquals(Boolean.FALSE, saved.getQuantityManual());
        assertEquals("supervisor1", saved.getAmcsUpdatedBy());
        assertEquals(java.time.LocalDateTime.of(2026, 10, 2, 8, 15, 30), saved.getAmcsUpdatedAt());

        // Same row again: nothing changed, so it is not rewritten
        Map<String, Object> again = service.importRows(List.of(r));
        assertEquals(1, again.get("unchanged"));
    }

    @Test
    void aSupervisorEditAppearingLaterUpdatesTheStoredRow() {
        service.importRows(List.of(row("2026-10-01 06:00:00.000000", "Morning", 22, 23.4, 760.5)));
        Map<String, Object> edited = row("2026-10-01 06:00:00.000000", "Morning", 22, 23.4, 760.5);
        edited.put("updatedBy", "supervisor1");
        edited.put("updatedAt", "2026-10-02 08:15:30.000000");

        Map<String, Object> out = service.importRows(List.of(edited));

        assertEquals(1, out.get("updated"));
        assertEquals("supervisor1", stored.get(0).getAmcsUpdatedBy());
    }

    @Test
    void badRowsAreRejectedWithoutBlockingTheGoodOnes() {
        Map<String, Object> noShift = row("2026-10-01 06:00:00.000000", "Noon", 1, 5.0, 100.0);
        Map<String, Object> zeroQty = row("2026-10-01 16:00:00.000000", "Evening", 2, 0.0, 0.0);
        Map<String, Object> good = row("2026-10-02 06:00:00.000000", "Morning", 3, 20.0, 650.0);

        Map<String, Object> out = service.importRows(List.of(noShift, zeroQty, good));

        assertEquals(3, out.get("received"));
        assertEquals(1, out.get("inserted"));
        @SuppressWarnings("unchecked")
        List<String> rejected = (List<String>) out.get("rejected");
        assertEquals(2, rejected.size());
        assertTrue(rejected.get(0).contains("shiftCode"));
    }
}
