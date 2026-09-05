package com.dairy.service.optimizer;

import com.dairy.dto.optimizer.FeedLineDTO;
import com.dairy.dto.optimizer.NutrientStatusDTO;
import com.dairy.exception.FeedNotFoundException;
import com.dairy.model.FeedMaster;
import com.dairy.model.FeedNutrition;
import com.dairy.repository.FeedNutritionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collection;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NutrientCalculationServiceTest {

    @Mock
    private FeedNutritionRepository feedNutritionRepository;

    @InjectMocks
    private NutrientCalculationService service;

    /** Nutrition rows carry their FeedMaster, which is how the service keys them by feed id. */
    private FeedNutrition nutrition(Long feedId, Double dm, Double cp, Double tdn, Double ca) {
        FeedMaster master = new FeedMaster();
        master.setId(feedId);
        FeedNutrition n = new FeedNutrition();
        n.setFeedMaster(master);
        n.setDryMatterPct(dm);
        n.setCrudeProteinPct(cp);
        n.setTdnPct(tdn);
        n.setCalciumPct(ca);
        return n;
    }

    @Test
    void calculateTotals_sumsAcrossMultipleFeeds() {
        when(feedNutritionRepository.findByFeedMasterIdInWithFeedMaster(anyCollection()))
                .thenReturn(List.of(
                        nutrition(1L, 90.0, 12.0, 55.0, 0.5),
                        nutrition(2L, 88.0, 20.0, 65.0, 1.2)));

        List<FeedLineDTO> lines = List.of(
                new FeedLineDTO(1L, "Grass", 10.0),
                new FeedLineDTO(2L, "Legume", 2.0));

        Map<String, Double> totals = service.calculateTotals(lines);

        // Feed1: DM=9.0, CP=1.08, TDN=4.95, Ca=45.0g ; Feed2: DM=1.76, CP=0.352, TDN=1.144, Ca=21.12g
        assertThat(totals.get("DryMatter")).isEqualTo(10.76);
        assertThat(totals.get("CrudeProtein")).isEqualTo(1.43);
        assertThat(totals.get("TDN")).isEqualTo(6.09);
        assertThat(totals.get("Calcium")).isEqualTo(66.12);
    }

    @Test
    void calculateTotals_skipsZeroAndNullQuantities() {
        List<FeedLineDTO> lines = List.of(
                new FeedLineDTO(1L, "Grass", 0.0),
                new FeedLineDTO(2L, "Legume", null));

        Map<String, Double> totals = service.calculateTotals(lines);

        assertThat(totals.get("DryMatter")).isEqualTo(0.0);
        assertThat(totals.get("CrudeProtein")).isEqualTo(0.0);
    }

    @Test
    void calculateTotals_missingDryMatterPct_fallsBackTo90Percent() {
        when(feedNutritionRepository.findByFeedMasterIdInWithFeedMaster(anyCollection()))
                .thenReturn(List.of(nutrition(3L, null, 10.0, 60.0, 0.3)));

        Map<String, Double> totals = service.calculateTotals(List.of(new FeedLineDTO(3L, "Unknown", 10.0)));

        assertThat(totals.get("DryMatter")).isEqualTo(9.0); // 10kg * 90% default
    }

    @Test
    void calculateTotals_noUsableLines_doesNotHitTheDatabase() {
        Map<String, Double> totals = service.calculateTotals(List.of(new FeedLineDTO(1L, "Grass", 0.0)));

        assertThat(totals.get("DryMatter")).isEqualTo(0.0);
        verify(feedNutritionRepository, never()).findByFeedMasterIdInWithFeedMaster(anyCollection());
    }

    @Test
    void calculateTotals_feedWithoutNutritionRow_throws() {
        when(feedNutritionRepository.findByFeedMasterIdInWithFeedMaster(anyCollection()))
                .thenReturn(List.of());

        assertThatThrownBy(() -> service.calculateTotals(List.of(new FeedLineDTO(9L, "Ghost", 5.0))))
                .isInstanceOf(FeedNotFoundException.class);
    }

    @Test
    void calculateTotals_repeatedFeed_isFetchedOnce() {
        when(feedNutritionRepository.findByFeedMasterIdInWithFeedMaster(anyCollection()))
                .thenReturn(List.of(nutrition(1L, 90.0, 12.0, 55.0, 0.5)));

        service.calculateTotals(List.of(
                new FeedLineDTO(1L, "Grass", 4.0),
                new FeedLineDTO(1L, "Grass", 6.0)));

        ArgumentCaptor<Collection<Long>> idsCaptor = ArgumentCaptor.forClass(Collection.class);
        verify(feedNutritionRepository).findByFeedMasterIdInWithFeedMaster(idsCaptor.capture());
        assertThat(idsCaptor.getValue()).containsExactly(1L);
    }

    @Test
    void evaluate_classifiesDeficientAdequateAndExcess() {
        Map<String, Double> totals = Map.of("DryMatter", 10.0, "CrudeProtein", 2.0, "TDN", 6.0);
        Map<String, Double> targets = Map.of("DryMatter", 15.0, "CrudeProtein", 1.0, "TDN", 6.0);

        Map<String, NutrientStatusDTO> result = service.evaluate(totals, targets);

        assertThat(result.get("DryMatter").getStatus()).isEqualTo("DEFICIENT"); // 10/15 = 0.667 < 0.9
        assertThat(result.get("CrudeProtein").getStatus()).isEqualTo("EXCESS"); // 2/1 = 2.0 > 1.2
        assertThat(result.get("TDN").getStatus()).isEqualTo("ADEQUATE"); // 6/6 = 1.0
    }

    @Test
    void evaluate_nullOrZeroRequirement_isAlwaysAdequate() {
        Map<String, Double> totals = Map.of("Calcium", 40.0);
        Map<String, Double> targets = new java.util.HashMap<>();
        targets.put("Calcium", null);

        Map<String, NutrientStatusDTO> result = service.evaluate(totals, targets);

        assertThat(result.get("Calcium").getStatus()).isEqualTo("ADEQUATE");
    }

    @Test
    void flatStatus_extractsStatusStringsOnly() {
        Map<String, NutrientStatusDTO> nutrientStatus = Map.of(
                "DryMatter", new NutrientStatusDTO(10.0, 15.0, "DEFICIENT"));

        Map<String, String> flat = service.flatStatus(nutrientStatus);

        assertThat(flat).containsEntry("DryMatter", "DEFICIENT");
    }
}
