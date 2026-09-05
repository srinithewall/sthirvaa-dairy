package com.dairy.service.optimizer;

import com.dairy.dto.optimizer.DefaultPlanResponseDTO;
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
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DefaultPlanServiceTest {

    @Mock private AnimalRequirementResolutionService requirementResolutionService;
    @Mock private FeedEligibilityService feedEligibilityService;
    @Mock private NutrientCalculationService nutrientCalculationService;
    @Mock private RationOptimizer rationOptimizer;
    @Mock private ObjectiveProperties objectiveProperties;
    @Mock private ConstraintProperties constraintProperties;

    @InjectMocks
    private DefaultPlanService service;

    private OptimizationFeed feed(long id, String name) {
        OptimizationFeed f = new OptimizationFeed();
        f.setFeedId(id);
        f.setFeedName(name);
        f.setNutrition(new FeedNutrition());
        return f;
    }

    private RequirementProfileDTO profile() {
        RequirementProfileDTO p = new RequirementProfileDTO();
        p.setResolvedStage("Early Lactation");
        AnimalRequirement req = new AnimalRequirement();
        req.setDryMatterIntake(15.0);
        p.setRequirement(req);
        Map<String, Double> targets = new LinkedHashMap<>();
        targets.put("DryMatter", 15.0);
        p.setTargets(targets);
        return p;
    }

    @Test
    void calculate_solvedCase_returnsFeedLinesAndNutrientEvaluation() {
        when(requirementResolutionService.resolve(1L, null)).thenReturn(profile());
        List<OptimizationFeed> feeds = List.of(feed(1L, "Grass"), feed(2L, "Concentrate"));
        when(feedEligibilityService.loadEligibleFeeds()).thenReturn(feeds);
        when(objectiveProperties.getDefaultPlan()).thenReturn(new ObjectiveProperties.Profile(1.0, 0.5, 0.0));
        when(constraintProperties.getMaxConcentrateShareOfDm()).thenReturn(0.5);
        when(constraintProperties.getNutrientUpperBoundTolerance()).thenReturn(1.3);

        OptimizationResult solverResult = new OptimizationResult();
        solverResult.setStatus(OptimizationResult.SOLVED);
        solverResult.setQuantitiesByFeedId(Map.of(1L, 10.0, 2L, 0.0)); // feed 2 solved to zero - should be dropped from feeds list
        when(rationOptimizer.solve(org.mockito.ArgumentMatchers.any())).thenReturn(solverResult);

        Map<String, Double> totals = Map.of("DryMatter", 9.0);
        when(nutrientCalculationService.calculateTotals(org.mockito.ArgumentMatchers.anyList())).thenReturn(totals);
        Map<String, NutrientStatusDTO> nutrientStatus = Map.of("DryMatter", new NutrientStatusDTO(9.0, 15.0, "DEFICIENT"));
        when(nutrientCalculationService.evaluate(totals, profile().getTargets())).thenReturn(nutrientStatus);
        when(nutrientCalculationService.flatStatus(nutrientStatus)).thenReturn(Map.of("DryMatter", "DEFICIENT"));

        DefaultPlanResponseDTO response = service.calculate(1L, null);

        assertThat(response.getSolverStatus()).isEqualTo(OptimizationResult.SOLVED);
        assertThat(response.getFeeds()).hasSize(1); // only feed 1, feed 2's zero quantity dropped
        assertThat(response.getFeeds().get(0).getFeedId()).isEqualTo(1L);
        assertThat(response.getResolvedStage()).isEqualTo("Early Lactation");
        assertThat(response.getStatus()).containsEntry("DryMatter", "DEFICIENT");
    }

    @Test
    void calculate_infeasibleCase_returnsEmptyFeedsAndInfeasibleStatus() {
        when(requirementResolutionService.resolve(2L, null)).thenReturn(profile());
        when(feedEligibilityService.loadEligibleFeeds()).thenReturn(List.of(feed(1L, "Grass")));
        when(objectiveProperties.getDefaultPlan()).thenReturn(new ObjectiveProperties.Profile(1.0, 0.5, 0.0));
        when(constraintProperties.getMaxConcentrateShareOfDm()).thenReturn(0.5);
        when(constraintProperties.getNutrientUpperBoundTolerance()).thenReturn(1.3);

        OptimizationResult solverResult = new OptimizationResult();
        solverResult.setStatus(OptimizationResult.INFEASIBLE);
        solverResult.setQuantitiesByFeedId(Map.of());
        when(rationOptimizer.solve(org.mockito.ArgumentMatchers.any())).thenReturn(solverResult);

        DefaultPlanResponseDTO response = service.calculate(2L, null);

        assertThat(response.getSolverStatus()).isEqualTo(OptimizationResult.INFEASIBLE);
        assertThat(response.getFeeds()).isEmpty();
        assertThat(response.getTotals()).isNull();
    }
}
