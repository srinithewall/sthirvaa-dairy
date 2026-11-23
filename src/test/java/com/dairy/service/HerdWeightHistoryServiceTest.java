package com.dairy.service;

import com.dairy.dto.HerdWeightHistory;
import com.dairy.model.Breed;
import com.dairy.model.Herd;
import com.dairy.model.HerdEvent;
import com.dairy.model.HerdWeightRecord;
import com.dairy.model.MeasurementMethod;
import com.dairy.model.MilkRecord;
import com.dairy.repo.BreedRepository;
import com.dairy.repo.HerdEventRepository;
import com.dairy.repo.HerdRepository;
import com.dairy.repo.HerdWeightRecordRepository;
import com.dairy.repo.MilkRecordRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class HerdWeightHistoryServiceTest {

    @Mock private HerdWeightRecordRepository weightRepo;
    @Mock private HerdRepository herdRepo;
    @Mock private HerdEventRepository eventRepo;
    @Mock private BreedRepository breedRepo;
    @Mock private MilkRecordRepository milkRepo;

    @InjectMocks private HerdWeightHistoryService service;

    private static final LocalDate TODAY = LocalDate.of(2026, 11, 22);
    private final List<HerdEvent> events = new ArrayList<>();
    private final List<HerdWeightRecord> records = new ArrayList<>();
    private Herd herd;

    @BeforeEach
    void setUp() {
        Breed gir = new Breed();
        gir.setName("Gir");
        gir.setBelowAvgMax(400.0);
        lenient().when(breedRepo.findAll()).thenReturn(List.of(gir));

        herd = new Herd();
        herd.setId(5L);
        herd.setTagNumber(" G-5 ");
        herd.setBreed("Gir");
        lenient().when(herdRepo.findById(5L)).thenReturn(Optional.of(herd));
        lenient().when(eventRepo.findByHerdIdOrderByEventDateDesc(5L)).thenReturn(events);
        lenient().when(weightRepo.findByHerdIdOrderByRecordDateDesc(5L)).thenReturn(records);
        lenient().when(milkRepo.findByHerdIdAndDateGreaterThanEqual(eq(5L), any())).thenReturn(List.of());
    }

    private HerdWeightRecord weighed(long id, LocalDate date, double kg) {
        HerdWeightRecord r = new HerdWeightRecord();
        r.setId(id);
        r.setHerdId(5L);
        r.setRecordDate(date);
        r.setWeightKg(kg);
        r.setMeasurementMethod(MeasurementMethod.HEART_GIRTH_TAPE);
        records.add(0, r); // repository returns newest first
        return r;
    }

    private void event(LocalDate date, String type, Double score) {
        HerdEvent e = new HerdEvent(5L, date, type, type, null);
        e.setScore(score);
        events.add(e);
    }

    @Test
    void readingsComeOldestFirstWithChangeAndDailyGain() {
        herd.setAnimalStatus("HEIFER");
        herd.setBirthDate(LocalDate.of(2025, 11, 22));
        weighed(1, LocalDate.of(2026, 6, 1), 150.4);
        weighed(2, LocalDate.of(2026, 7, 1), 168.6);

        HerdWeightHistory h = service.getHistory(5L, TODAY).orElseThrow();

        assertEquals("G-5", h.tagNumber());
        assertEquals(2, h.readings().size());
        HerdWeightHistory.Reading first = h.readings().get(0), second = h.readings().get(1);
        assertEquals(LocalDate.of(2026, 6, 1), first.date());
        assertEquals(150.0, first.weightKg());
        assertNull(first.changeKg());
        assertNull(first.gainGPerDay());
        assertEquals(19.0, second.changeKg());
        assertEquals(30, second.days());
        assertEquals(607, second.gainGPerDay()); // 18.2 kg over 30 days
    }

    @Test
    void theTargetFollowsTheGrowthCurveAtEachReadingsAge() {
        herd.setAnimalStatus("HEIFER");
        herd.setBirthDate(LocalDate.of(2025, 11, 22));
        weighed(1, LocalDate.of(2026, 3, 22), 100);
        weighed(2, LocalDate.of(2026, 9, 22), 180);

        List<HerdWeightHistory.Reading> r = service.getHistory(5L, TODAY).orElseThrow().readings();

        // The growth curve at four and ten months, not today's figure for both.
        long age4 = java.time.temporal.ChronoUnit.DAYS.between(herd.getBirthDate(), LocalDate.of(2026, 3, 22));
        long age10 = java.time.temporal.ChronoUnit.DAYS.between(herd.getBirthDate(), LocalDate.of(2026, 9, 22));
        assertEquals((double) Math.round(400 * WeightTarget.curveShare(age4)), r.get(0).targetKg());
        assertEquals((double) Math.round(400 * WeightTarget.curveShare(age10)), r.get(1).targetKg());
        assertEquals(4, r.get(0).ageMonths());
        assertEquals(10, r.get(1).ageMonths());
    }

    @Test
    void eachReadingUsesTheBcsInForceThatDay() {
        herd.setAnimalStatus("LACTATING");
        herd.setPreviousLactations(2);
        event(LocalDate.of(2026, 1, 10), HerdService.BCS_EVENT, 2.0);
        event(LocalDate.of(2026, 8, 10), HerdService.BCS_EVENT, 3.0);
        weighed(1, LocalDate.of(2026, 2, 1), 360);
        weighed(2, LocalDate.of(2026, 9, 1), 410);

        List<HerdWeightHistory.Reading> r = service.getHistory(5L, TODAY).orElseThrow().readings();

        assertEquals(2.0, r.get(0).bcs());
        assertEquals(LocalDate.of(2026, 1, 10), r.get(0).bcsDate());
        // Her frame at BCS 2 brought to BCS 3
        assertEquals((double) Math.round(WeightTarget.atIdealBcs(360, 2.0)), r.get(0).targetKg());
        assertEquals(3.0, r.get(1).bcs());
        assertEquals(410.0, r.get(1).targetKg());
        assertEquals(0.0, r.get(1).gapKg());
    }

    @Test
    void aScoreGivenSoonAfterTheFirstWeighingStillCounts() {
        herd.setAnimalStatus("DRY");
        herd.setPreviousLactations(1);
        event(LocalDate.of(2026, 5, 20), HerdService.BCS_EVENT, 3.5);
        weighed(1, LocalDate.of(2026, 5, 1), 420);

        HerdWeightHistory.Reading r = service.getHistory(5L, TODAY).orElseThrow().readings().get(0);

        assertEquals(3.5, r.bcs());
        assertEquals(LocalDate.of(2026, 5, 20), r.bcsDate());
    }

    @Test
    void aCowWeighedBeforeHerFirstCalvingIsTreatedAsAHeiferThen() {
        LocalDate calved = LocalDate.of(2026, 6, 1);
        event(calved, "CALVING", null);
        assertEquals("HEIFER", HerdWeightHistoryService.statusOn("LACTATING", events, calved.minusDays(30), 0));
        assertEquals("LACTATING", HerdWeightHistoryService.statusOn("LACTATING", events, calved, 1));
        // Bought in milk, nothing on record: keep what she is now.
        assertEquals("LACTATING", HerdWeightHistoryService.statusOn("LACTATING", List.of(), calved, 0));
    }

    @Test
    void pregnancyIsCountedAsOfTheReadingDay() {
        herd.setAnimalStatus("PREGNANT");
        herd.setPreviousLactations(1);
        event(LocalDate.of(2026, 1, 1), "SEMEN_GIVEN", null);
        event(LocalDate.of(2026, 3, 1), "PREGNANCY_CONFIRMED", null);
        weighed(1, LocalDate.of(2025, 12, 1), 400);
        weighed(2, LocalDate.of(2026, 8, 20), 450);

        List<HerdWeightHistory.Reading> r = service.getHistory(5L, TODAY).orElseThrow().readings();

        assertNull(r.get(0).daysPregnant());
        assertEquals(231, r.get(1).daysPregnant());
    }

    @Test
    void milkIsTotalledByMonthWithLitresPerMilkedDay() {
        MilkRecord a = milk(LocalDate.of(2026, 10, 1), 6.0);
        MilkRecord b = milk(LocalDate.of(2026, 10, 1), 5.0);
        MilkRecord c = milk(LocalDate.of(2026, 10, 2), 10.0);
        MilkRecord d = milk(LocalDate.of(2026, 11, 3), 8.0);

        List<HerdWeightHistory.MilkMonth> m = HerdWeightHistoryService.milkByMonth(List.of(a, b, c, d));

        assertEquals(2, m.size());
        assertEquals(LocalDate.of(2026, 10, 1), m.get(0).month());
        assertEquals(21.0, m.get(0).litres());
        assertEquals(2, m.get(0).daysMilked());
        assertEquals(10.5, m.get(0).avgPerDay());
        assertEquals(8.0, m.get(1).litres());
    }

    @Test
    void anUnknownAnimalHasNoHistory() {
        when(herdRepo.findById(99L)).thenReturn(Optional.empty());
        assertTrue(service.getHistory(99L, TODAY).isEmpty());
    }

    private static MilkRecord milk(LocalDate date, double litres) {
        MilkRecord m = new MilkRecord();
        m.setDate(date);
        m.setQuantity(litres);
        return m;
    }
}
