package com.dairy.service.optimizer;

import com.dairy.dto.FeedOptimizerResponseDTO;
import com.dairy.dto.optimizer.FeedAdjustmentDTO;
import com.dairy.dto.optimizer.FeedLineDTO;
import com.dairy.dto.optimizer.NutrientStatusDTO;
import com.dairy.dto.optimizer.RationResultDTO;
import com.dairy.dto.optimizer.RequirementProfileDTO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Current Ration: evaluates the farmer's actual feed quantities against the
 * animal's real requirements, then finds the smallest practical change (rule
 * 10/11) - the current ration is the optimizer's baseline, not a from-scratch
 * rebuild.
 */
@Service
public class CurrentRationOptimizationService {

    private static final Logger log = LoggerFactory.getLogger(CurrentRationOptimizationService.class);

    @Autowired
    private AnimalRequirementResolutionService requirementResolutionService;

    @Autowired
    private FeedEligibilityService feedEligibilityService;

    @Autowired
    private NutrientCalculationService nutrientCalculationService;

    @Autowired
    private RationOptimizer rationOptimizer;

    @Autowired
    private ObjectiveProperties objectiveProperties;

    @Autowired
    private ConstraintProperties constraintProperties;

    public FeedOptimizerResponseDTO optimize(Long animalId, String stageOverride, List<FeedLineDTO> currentFeedLines) {
        RequirementProfileDTO profile = requirementResolutionService.resolve(animalId, stageOverride);

        Map<String, Double> currentTotals = nutrientCalculationService.calculateTotals(currentFeedLines);
        Map<String, NutrientStatusDTO> currentNutrientStatus = nutrientCalculationService.evaluate(currentTotals, profile.getTargets());

        List<Long> currentFeedIds = currentFeedLines.stream().map(FeedLineDTO::getFeedId).collect(Collectors.toList());
        Map<Long, OptimizationFeed> pool = feedEligibilityService.loadCandidatePool(currentFeedIds);

        Map<Long, Double> baseline = new LinkedHashMap<>();
        for (FeedLineDTO line : currentFeedLines) {
            if (line.getQuantityKg() == null) continue;
            baseline.merge(line.getFeedId(), line.getQuantityKg(), Double::sum);
        }

        log.info("Current ration optimization for animal {}: resolvedStage={}, currentFeeds={}, candidatePool={}",
                animalId, profile.getResolvedStage(), currentFeedLines.size(), pool.size());

        OptimizationRequest request = new OptimizationRequest();
        request.setFeeds(new ArrayList<>(pool.values()));
        request.setNutrientTargets(profile.getTargets());
        request.setBaselineQtyByFeedId(baseline);
        request.setObjective(objectiveProperties.getCurrentRation());
        request.setConcentrateShareCap(constraintProperties.getMaxConcentrateShareOfDm());
        request.setNutrientUpperTolerance(constraintProperties.getNutrientUpperBoundTolerance());

        OptimizationResult result = rationOptimizer.solve(request);

        FeedOptimizerResponseDTO response = new FeedOptimizerResponseDTO();
        response.setRequirements(profile.getRequirement());
        response.setResolvedStage(profile.getResolvedStage());
        response.setTotals(currentTotals);
        response.setNutrientStatus(currentNutrientStatus);
        response.setStatus(nutrientCalculationService.flatStatus(currentNutrientStatus));
        response.setSolverStatus(result.getStatus());

        if (!result.isSolved()) {
            response.setAddRecommendations(List.of());
            response.setReduceRecommendations(List.of());
            response.setFinalStatus("Could not compute a feasible ration adjustment with the available feeds and constraints.");
            log.info("Current ration optimization for animal {} is INFEASIBLE", animalId);
            return response;
        }

        Map<Long, Double> solvedQuantities = result.getQuantitiesByFeedId();
        response.setProjected(buildProjected(pool.values(), solvedQuantities, profile.getTargets()));

        double epsilon = objectiveProperties.getChangeEpsilonKg();
        List<FeedAdjustmentDTO> add = new ArrayList<>();
        List<FeedAdjustmentDTO> reduce = new ArrayList<>();
        for (OptimizationFeed feed : pool.values()) {
            double before = baseline.getOrDefault(feed.getFeedId(), 0.0);
            double after = solvedQuantities.getOrDefault(feed.getFeedId(), 0.0);
            double delta = after - before;
            if (Math.abs(delta) < epsilon) continue;
            if (delta > 0) {
                add.add(new FeedAdjustmentDTO(feed.getFeedId(), feed.getFeedName(), round(delta)));
            } else {
                reduce.add(new FeedAdjustmentDTO(feed.getFeedId(), feed.getFeedName(), round(-delta)));
            }
        }
        response.setAddRecommendations(add);
        response.setReduceRecommendations(reduce);

        boolean allAdequate = currentNutrientStatus.values().stream()
                .allMatch(status -> "ADEQUATE".equals(status.getStatus()));
        if (allAdequate && add.isEmpty() && reduce.isEmpty()) {
            response.setFinalStatus("Current ration already meets requirements - no changes needed.");
        } else if (add.isEmpty() && reduce.isEmpty()) {
            response.setFinalStatus("Ration is within the required range - no changes needed.");
        } else {
            response.setFinalStatus("Adjust the ration as shown below to meet requirements.");
        }

        return response;
    }

    private RationResultDTO buildProjected(Collection<OptimizationFeed> feeds, Map<Long, Double> quantities, Map<String, Double> targets) {
        List<FeedLineDTO> feedLines = new ArrayList<>();
        for (OptimizationFeed feed : feeds) {
            Double qty = quantities.get(feed.getFeedId());
            if (qty == null || qty <= 0.001) continue;
            feedLines.add(new FeedLineDTO(feed.getFeedId(), feed.getFeedName(), qty));
        }

        Map<String, Double> totals = nutrientCalculationService.calculateTotals(feedLines);
        Map<String, NutrientStatusDTO> nutrientStatus = nutrientCalculationService.evaluate(totals, targets);

        RationResultDTO projected = new RationResultDTO();
        projected.setFeeds(feedLines);
        projected.setTotals(totals);
        projected.setNutrientStatus(nutrientStatus);
        projected.setStatus(nutrientCalculationService.flatStatus(nutrientStatus));
        projected.setSolverStatus(OptimizationResult.SOLVED);
        projected.setEstimatedCost(estimateCost(feeds, quantities));
        return projected;
    }

    private Double estimateCost(Collection<OptimizationFeed> feeds, Map<Long, Double> quantities) {
        double total = 0;
        boolean any = false;
        for (OptimizationFeed feed : feeds) {
            if (feed.getCostPerKgAsFed() == null) continue;
            Double qty = quantities.get(feed.getFeedId());
            if (qty == null) continue;
            total += feed.getCostPerKgAsFed() * qty;
            any = true;
        }
        return any ? round(total) : null;
    }

    private double round(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}
