package com.dairy.service;

import com.dairy.model.Asset;
import com.dairy.model.Herd;
import com.dairy.model.HerdEvent;
import com.dairy.repo.BreedRepository;
import com.dairy.repo.HerdEventRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
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
        assertThat(AssetValuationService.defaultPrice(cross)[0]).isEqualTo(90000);
        cross.setBreed("HF");
        assertThat(AssetValuationService.defaultPrice(cross)[0]).isEqualTo(150000);
    }

    @Test
    void calfWithNoPurchaseDataUsesBreedPrice() {
        Asset a = value(herd("CALF", 6, 0), asset(null, null));
        assertThat(a.getSuggestedValue()).isEqualTo(27000);
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
        // implied adult would be about 1,700; held at 50% of the 90,000 breed price
        assertThat(a.getSuggestedValue()).isEqualTo(13500);
        assertThat(a.getValuationFactors()).anyMatch(f -> f.contains("limited to 50%"));
    }

    @Test
    void animalBoughtAsAnAdultIsNotAnchored() {
        Herd h = herd("HEIFER", 30, 0);
        Asset a = value(h, asset(120000.0, today.minusMonths(2)));
        assertThat(a.getSuggestedValue()).isEqualTo(76500);
    }

    @Test
    void nineMonthPregnantHeiferIsNearOneLakh() {
        Herd h = herd("PREGNANT", 25, 0);
        Asset a = value(h, asset(null, null), event("SEMEN_GIVEN", today.minusDays(270)));
        assertThat(a.getSuggestedValue()).isEqualTo(102000);
        assertThat(a.getValuationInputs()).containsEntry("Pregnancy", "270 days");
    }

    @Test
    void unbredHeiferDoesNotJumpToAdultAtMonth25() {
        Asset a = value(herd("HEIFER", 25, 0), asset(null, null));
        assertThat(a.getSuggestedValue()).isEqualTo(64500);
    }

    @Test
    void adultCowStillUsesLactationAndMilk() {
        Herd h = herd("LACTATING", 48, 2);
        h.setAvgMilk30Days(12.0);
        h.setDim(60);
        Asset a = value(h, asset(null, null));
        // 90,000 x 1.05 (lactation 2) x 1.05 (milk at the 12 L norm) = 99,225
        assertThat(a.getSuggestedValue()).isEqualTo(99000);
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
