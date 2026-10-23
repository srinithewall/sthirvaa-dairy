package com.dairy.service;

import com.dairy.model.Herd;
import com.dairy.model.MilkRecord;
import com.dairy.repo.MilkDispatchRepository;
import com.dairy.repo.MilkRecordRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;

/**
 * The production summary must keep sales (milk sold to customers) apart from milk that went to
 * the calf, own use or waste, so sales + calf + own use + waste can be compared with the day's total.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MilkRecordServiceSummaryTest {

    private static final LocalDate DAY = LocalDate.of(2026, 10, 23);

    @Mock private MilkRecordRepository milkRecordRepository;
    @Mock private MilkDispatchRepository dispatchRepository;

    private MilkRecordService service;

    @BeforeEach
    void setUp() {
        service = new MilkRecordService();
        ReflectionTestUtils.setField(service, "milkRecordRepository", milkRecordRepository);
        ReflectionTestUtils.setField(service, "dispatchRepository", dispatchRepository);
    }

    private static MilkRecord record(LocalDate date, String shift, double litres, long herdId) {
        Herd herd = new Herd();
        herd.setId(herdId);
        MilkRecord r = new MilkRecord();
        r.setHerd(herd);
        r.setDate(date);
        r.setShift(shift);
        r.setQuantity(litres);
        return r;
    }

    private static Object[] dispatched(LocalDate date, String type, double litres) {
        return new Object[] { date, type, litres };
    }

    @Test
    void salesExcludeCalfOwnUseAndWasteButEverythingIsReported() {
        when(milkRecordRepository.findAllByOrderByDateDesc()).thenReturn(new ArrayList<>(List.of(
            record(DAY, "MORNING", 31.1, 1), record(DAY, "EVENING", 24.9, 2))));
        when(dispatchRepository.sumQuantityByDateAndType()).thenReturn(List.of(
            dispatched(DAY, "CUSTOMER", 50.0), dispatched(DAY, "CALF", 6.0)));

        Map<String, Object> day = service.getDailySummary().get(0);

        assertEquals(56.0, day.get("total"));
        assertEquals(50.0, day.get("sales"));
        assertEquals(6.0, day.get("calf"));
        assertEquals(0.0, day.get("ownUse"));
        assertEquals(0.0, day.get("waste"));
        assertEquals(56.0, day.get("distributed")); // all accounted, whatever the use
    }

    @Test
    void ownUseAndWasteAreReportedSeparately() {
        when(milkRecordRepository.findAllByOrderByDateDesc()).thenReturn(new ArrayList<>(List.of(
            record(DAY, "MORNING", 30.0, 1), record(DAY, "EVENING", 20.0, 2))));
        when(dispatchRepository.sumQuantityByDateAndType()).thenReturn(List.of(
            dispatched(DAY, "CUSTOMER", 40.0), dispatched(DAY, "OWN_USE", 4.5), dispatched(DAY, "WASTE", 1.5),
            dispatched(DAY, "CALF", 4.0)));

        Map<String, Object> day = service.getDailySummary().get(0);

        assertEquals(40.0, day.get("sales"));
        assertEquals(4.5, day.get("ownUse"));
        assertEquals(1.5, day.get("waste"));
        assertEquals(4.0, day.get("calf"));
        assertEquals(50.0, day.get("distributed"));
    }

    @Test
    void severalRowsOfTheSameTypeAreAddedAndOtherDaysAreIndependent() {
        LocalDate other = DAY.minusDays(1);
        when(milkRecordRepository.findAllByOrderByDateDesc()).thenReturn(new ArrayList<>(List.of(
            record(DAY, "MORNING", 25.0, 1), record(other, "MORNING", 24.0, 1))));
        when(dispatchRepository.sumQuantityByDateAndType()).thenReturn(List.of(
            dispatched(DAY, "CUSTOMER", 10.0), dispatched(DAY, "CUSTOMER", 14.0), dispatched(other, "CUSTOMER", 24.0)));

        List<Map<String, Object>> days = service.getDailySummary();

        assertEquals(24.0, days.get(0).get("sales"));
        assertEquals(24.0, days.get(1).get("sales"));
    }

    @Test
    void aDayWithNoDispatchesHasZeroEverywhere() {
        when(milkRecordRepository.findAllByOrderByDateDesc()).thenReturn(new ArrayList<>(List.of(
            record(DAY, "MORNING", 25.0, 1))));
        when(dispatchRepository.sumQuantityByDateAndType()).thenReturn(List.of());

        Map<String, Object> day = service.getDailySummary().get(0);

        assertEquals(0.0, day.get("sales"));
        assertEquals(0.0, day.get("calf"));
        assertEquals(0.0, day.get("distributed"));
    }

    @Test
    void aDispatchWithNoTypeCountsAsASale() {
        // Rows written before dispatch types existed carry no type; they were all customer sales
        when(milkRecordRepository.findAllByOrderByDateDesc()).thenReturn(new ArrayList<>(List.of(
            record(DAY, "MORNING", 25.0, 1))));
        when(dispatchRepository.sumQuantityByDateAndType()).thenReturn(List.<Object[]>of(new Object[] { DAY, null, 25.0 }));

        assertEquals(25.0, service.getDailySummary().get(0).get("sales"));
    }
}
