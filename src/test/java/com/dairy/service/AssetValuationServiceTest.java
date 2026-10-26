package com.dairy.service;

import com.dairy.model.Asset;
import com.dairy.model.Herd;
import com.dairy.model.HerdEvent;
import com.dairy.repo.BreedRepository;
import com.dairy.repo.HerdEventRepository;
import com.dairy.repo.MilkRecordRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AssetValuationServiceTest {

    @Mock private HerdService herdService;
    @Mock private HerdEventRepository eventRepository;
    @Mock private BreedRepository breedRepository;
    @Mock private MilkRecordRepository milkRecordRepository;

    @InjectMocks
    private AssetValuationService service;

    private final LocalDate today = LocalDate.now();

    private Herd herd(String status, int ageMonths, int lactation) {
        Herd h = new Herd();
        h.setId(1L);
        h.setTagNumber("T1");
        h.setAnimalType("COW");
        h.setBreed("HF Cross");
        h.setAnimalStatus(status);
        h.setBirthDate(today.minusMonths(ageMonths));
        h.setLactationNumber(lactation);
        return h;
    }

    private Asset asset(Double cost, LocalDate purchased) {
        Asset a = new Asset();
        a.setName("Cow (T1)");
        a.setCategory("Cow");
        a.setSerialNumber("T1");
        a.setValue(cost);
        a.setPurchaseDate(purchased);
        return a;
    }

    private Asset value(Herd herd, Asset asset, HerdEvent... events) {
        when(herdService.getAllHerds()).thenReturn(List.of(herd));
        lenient().when(eventRepository.findByHerdIdInOrderByEventDateDesc(anyCollection())).thenReturn(List.of(events));
        when(breedRepository.findAll()).thenReturn(List.of());
        service.withValues(List.of(asset));
        return asset;
    }

    private HerdEvent event(String type, LocalDate date) {
        HerdEvent e = new HerdEvent();
        e.setHerdId(1L);
        e.setEventType(type);
        e.setEventDate(date);
        return e;
    }

    @Test
    void growthFactorFollowsTheAgreedCurve() {
        assertThat(AssetValuationService.growthFactor(1)).isCloseTo(0.175, within(1e-9));
        assertThat(AssetValuationService.growthFactor(6)).isCloseTo(0.30, within(1e-9));
        assertThat(AssetValuationService.growthFactor(12)).isCloseTo(0.45, within(1e-9));
        assertThat(AssetValuationService.growthFactor(24)).isCloseTo(0.69, within(1e-9));
        assertThat(AssetValuationService.growthFactor(25)).isCloseTo(0.69 + 0.16 / 6, within(1e-9));
        assertThat(AssetValuationService.growthFactor(30)).isCloseTo(0.85, within(1e-9));
        assertThat(AssetValuationService.growthFactor(60)).isCloseTo(0.85, within(1e-9));
    }

    @Test
    void hfDefaultsMatchTheMarket() {
        Herd cross = herd("COW", 40, 1);
        assertThat(AssetValuationService.defaultPrice(cross)[0]).isEqualTo(80000);
        cross.setBreed("HF");
        assertThat(AssetValuationService.defaultPrice(cross)[0]).isEqualTo(150000);
    }

    @Test
    void calfWithNoPurchaseDataUsesBreedPrice() {
        Asset a = value(herd("CALF", 6, 0), asset(null, null));
        assertThat(a.getSuggestedValue()).isEqualTo(24000);
    }

    @Test
    void calfBoughtYoungIsPricedFromWhatWasPaid() {
        Herd h = herd("CALF", 6, 0);
        // bought today at 6 months for 30,300: implied adult 1,01,000, so value stays at about what was paid
        Asset a = value(h, asset(30300.0, today));
        assertThat(a.getSuggestedValue()).isEqualTo(30500);
        assertThat(a.getValuationFactors()).anyMatch(f -> f.startsWith("Adult price ₹1,01,000"));
    }

    @Test
    void anchoredPriceIsLimitedWhenCostLooksWrong() {
        Asset a = value(herd("CALF", 6, 0), asset(500.0, today));
        // implied adult would be about 1,700; held at 50% of the 80,000 breed price
        assertThat(a.getSuggestedValue()).isEqualTo(12000);
        assertThat(a.getValuationFactors()).anyMatch(f -> f.contains("limited to 50%"));
    }

    @Test
    void animalBoughtAsAnAdultIsNotAnchored() {
        Herd h = herd("HEIFER", 30, 0);
        Asset a = value(h, asset(120000.0, today.minusMonths(2)));
        assertThat(a.getSuggestedValue()).isEqualTo(68000);
    }

    @Test
    void nineMonthPregnantHeiferIsNearOneLakh() {
        Herd h = herd("PREGNANT", 25, 0);
        Asset a = value(h, asset(null, null), event("SEMEN_GIVEN", today.minusDays(270)));
        assertThat(a.getSuggestedValue()).isEqualTo(91000);
        assertThat(a.getValuationInputs()).containsEntry("Pregnancy", "270 days");
    }

    @Test
    void unbredHeiferDoesNotJumpToAdultAtMonth25() {
        Asset a = value(herd("HEIFER", 25, 0), asset(null, null));
        assertThat(a.getSuggestedValue()).isEqualTo(57500);
    }

    @Test
    void adultCowStillUsesLactationAndMilk() {
        Herd h = herd("LACTATING", 48, 2);
        h.setAvgMilk30Days(12.0);
        h.setDim(60);
        Asset a = value(h, asset(null, null));
        // 60 DIM is near peak, so 12 L is judged against 12 x 1.25 = 15 L expected: milk factor 0.65 + 0.35 x 0.8 = 0.93
        // 80,000 x 1.05 (lactation 2) x 0.93 = 78,120
        assertThat(a.getSuggestedValue()).isEqualTo(78000);
    }

    @Test
    void lactationShapeAveragesOneAndPeaksEarly() {
        double sum = 0;
        for (int d = 1; d <= 305; d++) sum += AssetValuationService.lactationShape(d);
        assertThat(sum / 305).isCloseTo(1.0, within(1e-9));
        assertThat(AssetValuationService.lactationShape(50)).isGreaterThan(AssetValuationService.lactationShape(1));
        assertThat(AssetValuationService.lactationShape(50)).isGreaterThan(AssetValuationService.lactationShape(235));
        assertThat(AssetValuationService.lactationShape(235)).isCloseTo(0.82, within(0.01));
        // a cow still milking past 305 days is judged against the day-305 expectation
        assertThat(AssetValuationService.lactationShape(400)).isEqualTo(AssetValuationService.lactationShape(305));
    }

    @Test
    void lateLactationCowIsNotPenalisedForYieldThatHasNaturallyFallen() {
        // Yashoda: HF cross, 1st lactation, 235 days in milk, 6.7 L/day, not confirmed pregnant
        Herd h = herd("LACTATING", 37, 1);
        h.setAvgMilk30Days(6.7);
        h.setDim(235);
        Asset a = value(h, asset(76500.0, today.minusMonths(5)));
        // expected at 235 DIM is 12 x 0.82 = 9.8 L, so milk factor 0.89 (a flat 12 L norm would give 0.83);
        // 80,000 x 1.0 x 0.89 x 0.9 (not pregnant after 150 DIM) = 64,000
        assertThat(a.getSuggestedValue()).isEqualTo(64000);
        assertThat(a.getValuationFactors()).anyMatch(f -> f.contains("expected at 235 days in milk"));
    }

    private Asset radha(int daysPregnant) {
        // Radha: HF cross, 4 yr, 1st lactation finished at about 7.6 L/day, dry and pregnant
        Herd h = herd("DRY", 49, 1);
        List<Object[]> rows = new ArrayList<>();
        for (int i = 0; i < 100; i++) rows.add(new Object[]{1L, today.minusDays(i + 20), 7.64});
        when(milkRecordRepository.sumDailyByHerdIdsSince(anyCollection(), org.mockito.ArgumentMatchers.any())).thenReturn(rows);
        return value(h, asset(75000.0, today.minusYears(1)),
                event("CALF_DELIVERED", today.minusDays(389)),
                event("SEMEN_GIVEN", today.minusDays(daysPregnant)),
                event("PREGNANCY_CONFIRMED", today.minusDays(daysPregnant - 30)));
    }

    @Test
    void dryCowIsJudgedByHerWholeLactation() {
        Asset a = radha(199);
        // 80,000 x 1.00 (lactation 1) x 0.87 (7.6 L vs 12 L) x 1.105 (199 days pregnant) = 77,200
        assertThat(a.getSuggestedValue()).isEqualTo(77000);
        assertThat(a.getValuationFactors()).anyMatch(f -> f.startsWith("Milk 7.6 L/day this lactation"));
        assertThat(a.getValuationInputs()).containsKey("Milk, this lactation");
    }

    @Test
    void dryCowNineMonthsPregnantIsAboutEightyThousand() {
        assertThat(radha(270).getSuggestedValue()).isEqualTo(80000);
    }

    @Test
    void dryCowWithNoMilkRecordsGetsNoMilkFactor() {
        Herd h = herd("DRY", 49, 1);
        Asset a = value(h, asset(null, null), event("CALF_DELIVERED", today.minusDays(389)));
        assertThat(a.getSuggestedValue()).isEqualTo(80000);
    }

    @Test
    void animalAssetWithoutHerdRecordIsFlaggedNotSilentlyPriced() {
        Asset a = asset(76500.0, today.minusYears(1));
        a.setSerialNumber("NO-SUCH-TAG");
        value(herd("LACTATING", 48, 2), a);
        assertThat(a.getValuationBasis()).isEqualTo("UNLINKED");
        assertThat(a.getSuggestedValue()).isNull();
        assertThat(a.getValuationWarning()).contains("NO-SUCH-TAG");
        assertThat(a.getEffectiveMarketValue()).isEqualTo(76500.0);
    }
}
