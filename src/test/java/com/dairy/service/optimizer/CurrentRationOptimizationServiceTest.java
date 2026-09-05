package com.dairy.service.optimizer;

import com.dairy.dto.FeedOptimizerResponseDTO;
import com.dairy.dto.optimizer.FeedLineDTO;
import com.dairy.dto.optimizer.NutrientStatusDTO;
import com.dairy.dto.optimizer.RequirementProfileDTO;
import com.dairy.model.AnimalRequirement;
import com.dairy.model.FeedNutrition;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CurrentRationOptimizationServiceTest {

    @Mock private AnimalRequirementResolutionService requirementResolutionService;
    @Mock private FeedEligibilityService feedEligibilityService;
    @Mock private NutrientCalculationService nutrientCalculationService;
    @Mock private RationOptimizer rationOptimizer;
    @Mock private ObjectiveProperties objectiveProperties;
    @Mock private ConstraintProperties constraintProperties;

    @InjectMocks
    private CurrentRationOptimizationService service;

    private OptimizationFeed feed(long id, String name) {
        OptimizationFeed f = new OptimizationFeed();
        f.setFeedId(id);
        f.setFeedName(name);
        f.setNutrition(new FeedNutrition());
        return f;
    }

    private RequirementProfileDTO profileWithTargets() {
        RequirementProfileDTO p = new RequirementProfileDTO();
        p.setResolvedStage("Early Lactation");
        p.setRequirement(new AnimalRequirement());
        Map<String, Double> targets = new LinkedHashMap<>();
        targets.put("DryMatter", 15.0);
        p.setTargets(targets);
        return p;
    }

    private void stubCommon(Long animalId) {
        when(requirementResolutionService.resolve(animalId, null)).thenReturn(profileWithTargets());
        when(objectiveProperties.getCurrentRation()).thenReturn(new ObjectiveProperties.Profile(0.3, 0.5, 2.0));
        lenient().when(objectiveProperties.getChangeEpsilonKg()).thenReturn(0.05); // not consulted on the infeasible early-return path
        when(constraintProperties.getMaxConcentrateShareOfDm()).thenReturn(0.5);
        when(constraintProperties.getNutrientUpperBoundTolerance()).thenReturn(1.3);
    }

    @Test
    void optimize_deficientRation_producesAddRecommendation() {
        stubCommon(1L);
        List<FeedLineDTO> current = List.of(new FeedLineDTO(1L, "Grass", 5.0));
        when(feedEligibilityService.loadCandidatePool(List.of(1L))).thenReturn(Map.of(1L, feed(1L, "Grass")));

        Map<String, Double> currentTotals = Map.of("DryMatter", 4.5);
        Map<String, NutrientStatusDTO> currentStatus = Map.of("DryMatter", new NutrientStatusDTO(4.5, 15.0, "DEFICIENT"));
        when(nutrientCalculationService.evaluate(currentTotals, profileWithTargets().getTargets())).thenReturn(currentStatus);
        when(nutrientCalculationService.flatStatus(currentStatus)).thenReturn(Map.of("DryMatter", "DEFICIENT"));

        OptimizationResult solved = new OptimizationResult();
        solved.setStatus(OptimizationResult.SOLVED);
        solved.setQuantitiesByFeedId(Map.of(1L, 16.0)); // solver adds 11kg
        when(rationOptimizer.solve(any())).thenReturn(solved);

        Map<String, Double> projectedTotals = Map.of("DryMatter", 15.0);
        when(nutrientCalculationService.calculateTotals(anyList())).thenReturn(currentTotals, projectedTotals);
        Map<String, NutrientStatusDTO> projectedStatus = Map.of("DryMatter", new NutrientStatusDTO(15.0, 15.0, "ADEQUATE"));
        when(nutrientCalculationService.evaluate(projectedTotals, profileWithTargets().getTargets())).thenReturn(projectedStatus);
        when(nutrientCalculationService.flatStatus(projectedStatus)).thenReturn(Map.of("DryMatter", "ADEQUATE"));

        FeedOptimizerResponseDTO response = service.optimize(1L, null, current);

        assertThat(response.getAddRecommendations()).hasSize(1);
        assertThat(response.getAddRecommendations().get(0).getFeedId()).isEqualTo(1L);
        assertThat(response.getAddRecommendations().get(0).getQuantityKg()).isEqualTo(11.0);
        assertThat(response.getReduceRecommendations()).isEmpty();
        assertThat(response.getFinalStatus()).contains("Adjust the ration");
    }

    @Test
    void optimize_alreadyAdequateAndNoDrift_reportsNothingToChange() {
        stubCommon(2L);
        List<FeedLineDTO> current = List.of(new FeedLineDTO(1L, "Grass", 16.0));
        when(feedEligibilityService.loadCandidatePool(List.of(1L))).thenReturn(Map.of(1L, feed(1L, "Grass")));

        Map<String, Double> currentTotals = Map.of("DryMatter", 15.0);
        when(nutrientCalculationService.calculateTotals(anyList())).thenReturn(currentTotals);
        Map<String, NutrientStatusDTO> status = Map.of("DryMatter", new NutrientStatusDTO(15.0, 15.0, "ADEQUATE"));
        when(nutrientCalculationService.evaluate(any(), any())).thenReturn(status);
        when(nutrientCalculationService.flatStatus(status)).thenReturn(Map.of("DryMatter", "ADEQUATE"));

        OptimizationResult solved = new OptimizationResult();
        solved.setStatus(OptimizationResult.SOLVED);
        solved.setQuantitiesByFeedId(Map.of(1L, 16.0)); // no change from baseline
        when(rationOptimizer.solve(any())).thenReturn(solved);

        FeedOptimizerResponseDTO response = service.optimize(2L, null, current);

        assertThat(response.getAddRecommendations()).isEmpty();
        assertThat(response.getReduceRecommendations()).isEmpty();
        assertThat(response.getFinalStatus()).contains("already meets requirements");
    }

    @Test
    void optimize_infeasible_reportsInfeasibleFinalStatusAndNoRecommendations() {
        stubCommon(3L);
        List<FeedLineDTO> current = List.of(new FeedLineDTO(1L, "Grass", 5.0));
        when(feedEligibilityService.loadCandidatePool(List.of(1L))).thenReturn(Map.of(1L, feed(1L, "Grass")));
        when(nutrientCalculationService.calculateTotals(anyList())).thenReturn(Map.of("DryMatter", 4.5));
        Map<String, NutrientStatusDTO> status = Map.of("DryMatter", new NutrientStatusDTO(4.5, 15.0, "DEFICIENT"));
        when(nutrientCalculationService.evaluate(any(), any())).thenReturn(status);
        when(nutrientCalculationService.flatStatus(status)).thenReturn(Map.of("DryMatter", "DEFICIENT"));

        OptimizationResult infeasible = new OptimizationResult();
        infeasible.setStatus(OptimizationResult.INFEASIBLE);
        infeasible.setQuantitiesByFeedId(Map.of());
        when(rationOptimizer.solve(any())).thenReturn(infeasible);

        FeedOptimizerResponseDTO response = service.optimize(3L, null, current);

        assertThat(response.getSolverStatus()).isEqualTo(OptimizationResult.INFEASIBLE);
        assertThat(response.getAddRecommendations()).isEmpty();
        assertThat(response.getReduceRecommendations()).isEmpty();
        assertThat(response.getFinalStatus()).contains("Could not compute");
    }
}
