package com.dairy.service.optimizer;

import com.dairy.dto.optimizer.FeedLineDTO;
import com.dairy.dto.optimizer.NutrientStatusDTO;
import com.dairy.dto.optimizer.PlanAdequacyDTO;
import com.dairy.dto.optimizer.PlanAssignmentDTO;
import com.dairy.dto.optimizer.PlanDetailDTO;
import com.dairy.dto.optimizer.RequirementProfileDTO;
import com.dairy.model.Herd;
import com.dairy.service.HerdService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PlanAdequacyServiceTest {

    @Mock private CustomPlanService customPlanService;
    @Mock private HerdService herdService;
    @Mock private AnimalRequirementResolutionService requirementResolutionService;
    @Mock private NutrientCalculationService nutrientCalculationService;

    @InjectMocks
    private PlanAdequacyService service;

    private PlanDetailDTO planWith(List<Long> assignedAnimalIds) {
        PlanDetailDTO plan = new PlanDetailDTO();
        plan.setId(5L);
        plan.setPlanName("Group Ration");
        plan.setFeeds(List.of(new FeedLineDTO(10L, "Grass", 12.0)));
        plan.setAssignments(assignedAnimalIds.stream()
                .map(id -> new PlanAssignmentDTO(id, "Cow" + id, "TAG-" + id))
                .toList());
        return plan;
    }

    private Herd herd(Long id) {
        Herd h = new Herd();
        h.setId(id);
        h.setAnimalName("Cow" + id);
        h.setTagNumber("TAG-" + id);
        return h;
    }

    private RequirementProfileDTO profile(String stage, double dmTarget) {
        RequirementProfileDTO p = new RequirementProfileDTO();
        p.setResolvedStage(stage);
        p.setTargets(Map.of("DryMatter", dmTarget));
        return p;
    }

    @Test
    void evaluate_sameRation_canSuitOneAnimalAndNotAnother() {
        when(customPlanService.loadPlan(5L)).thenReturn(planWith(List.of(1L, 2L)));
        when(nutrientCalculationService.calculateTotals(any())).thenReturn(Map.of("DryMatter", 12.0));
        when(herdService.getHerdsByIds(anyCollection())).thenReturn(List.of(herd(1L), herd(2L)));

        when(requirementResolutionService.resolve(any(Herd.class), eq(null)))
                .thenReturn(profile("Mid Lactation", 12.0), profile("Early Lactation", 18.0));
        when(nutrientCalculationService.evaluate(any(), eq(Map.of("DryMatter", 12.0))))
                .thenReturn(Map.of("DryMatter", new NutrientStatusDTO(12.0, 12.0, "ADEQUATE")));
        when(nutrientCalculationService.evaluate(any(), eq(Map.of("DryMatter", 18.0))))
                .thenReturn(Map.of("DryMatter", new NutrientStatusDTO(12.0, 18.0, "DEFICIENT")));

        List<PlanAdequacyDTO> results = service.evaluate(5L, null);

        assertThat(results).hasSize(2);
        assertThat(results.get(0).getOverallStatus()).isEqualTo("ADEQUATE");
        assertThat(results.get(0).getResolvedStage()).isEqualTo("Mid Lactation");
        assertThat(results.get(1).getOverallStatus()).isEqualTo("DEFICIENT");
    }

    @Test
    void evaluate_totalsComputedOncePerCall_notPerAnimal() {
        when(customPlanService.loadPlan(5L)).thenReturn(planWith(List.of(1L, 2L)));
        when(nutrientCalculationService.calculateTotals(any())).thenReturn(Map.of("DryMatter", 12.0));
        when(herdService.getHerdsByIds(anyCollection())).thenReturn(List.of(herd(1L), herd(2L)));
        when(requirementResolutionService.resolve(any(Herd.class), eq(null)))
                .thenReturn(profile("Mid Lactation", 12.0));
        when(nutrientCalculationService.evaluate(any(), any()))
                .thenReturn(Map.of("DryMatter", new NutrientStatusDTO(12.0, 12.0, "ADEQUATE")));

        service.evaluate(5L, null);

        // The ration is the same for everyone; only the requirement differs.
        verify(nutrientCalculationService, times(1)).calculateTotals(any());
        verify(nutrientCalculationService, times(2)).evaluate(any(), any());
    }

    @Test
    void evaluate_explicitAnimalIds_overrideTheAssignedSet() {
        when(customPlanService.loadPlan(5L)).thenReturn(planWith(List.of(1L)));
        when(nutrientCalculationService.calculateTotals(any())).thenReturn(Map.of("DryMatter", 12.0));
        when(herdService.getHerdsByIds(List.of(7L, 8L))).thenReturn(List.of(herd(7L), herd(8L)));
        when(requirementResolutionService.resolve(any(Herd.class), eq(null)))
                .thenReturn(profile("Dry", 9.0));
        when(nutrientCalculationService.evaluate(any(), any()))
                .thenReturn(Map.of("DryMatter", new NutrientStatusDTO(12.0, 9.0, "EXCESS")));

        List<PlanAdequacyDTO> results = service.evaluate(5L, List.of(7L, 8L));

        assertThat(results).extracting(PlanAdequacyDTO::getAnimalId).containsExactly(7L, 8L);
        assertThat(results.get(0).getOverallStatus()).isEqualTo("EXCESS");
    }

    @Test
    void evaluate_unassignedPlanWithNoIds_returnsEmptyWithoutTouchingTheHerd() {
        when(customPlanService.loadPlan(5L)).thenReturn(planWith(List.of()));

        assertThat(service.evaluate(5L, null)).isEmpty();
        verify(herdService, never()).getHerdsByIds(anyCollection());
        verify(nutrientCalculationService, never()).calculateTotals(any());
    }

    @Test
    void evaluate_deficiencyWinsOverExcess() {
        when(customPlanService.loadPlan(5L)).thenReturn(planWith(List.of(1L)));
        when(nutrientCalculationService.calculateTotals(any())).thenReturn(Map.of());
        when(herdService.getHerdsByIds(anyCollection())).thenReturn(List.of(herd(1L)));
        when(requirementResolutionService.resolve(any(Herd.class), eq(null)))
                .thenReturn(profile("Mid Lactation", 12.0));
        when(nutrientCalculationService.evaluate(any(), any())).thenReturn(Map.of(
                "DryMatter", new NutrientStatusDTO(20.0, 12.0, "EXCESS"),
                "CrudeProtein", new NutrientStatusDTO(0.5, 1.8, "DEFICIENT")));

        List<PlanAdequacyDTO> results = service.evaluate(5L, null);

        // A shortfall is the thing that harms the animal, so it must not be masked by a surplus.
        assertThat(results.get(0).getOverallStatus()).isEqualTo("DEFICIENT");
    }
}
