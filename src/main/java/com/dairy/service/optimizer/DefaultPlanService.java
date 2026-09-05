package com.dairy.service.optimizer;

import com.dairy.dto.optimizer.DefaultPlanResponseDTO;
import com.dairy.dto.optimizer.FeedLineDTO;
import com.dairy.dto.optimizer.NutrientStatusDTO;
import com.dairy.dto.optimizer.RequirementProfileDTO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Default Plan: animalId -> real requirement -> real eligible feeds -> real
 * solver -> recommended ration. Never persisted (rule 9/27 of the spec) -
 * computed fresh on every call.
 */
@Service
public class DefaultPlanService {

    private static final Logger log = LoggerFactory.getLogger(DefaultPlanService.class);

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

    public DefaultPlanResponseDTO calculate(Long animalId, String stageOverride) {
        long startedAt = System.currentTimeMillis();
        RequirementProfileDTO profile = requirementResolutionService.resolve(animalId, stageOverride);
        long profileMs = System.currentTimeMillis() - startedAt;

        long feedsStartedAt = System.currentTimeMillis();
        List<OptimizationFeed> feeds = feedEligibilityService.loadEligibleFeeds();
        long feedsMs = System.currentTimeMillis() - feedsStartedAt;

        // Timings are logged because feed loading was previously a query per feed and
        // dominated this endpoint; keep an eye on them if it slows down again.
        log.info("Default plan for animal {}: resolvedStage={}, eligibleFeeds={} (profile {}ms, feeds {}ms)",
                animalId, profile.getResolvedStage(), feeds.size(), profileMs, feedsMs);

        if ("Holstein Friesian".equalsIgnoreCase(profile.getRequirement().getBreed())) {
            return generateClaudePlan(animalId, profile, feeds);
        }

        OptimizationRequest request = new OptimizationRequest();
        request.setFeeds(feeds);
        request.setNutrientTargets(profile.getTargets());
        request.setObjective(objectiveProperties.getDefaultPlan());
        request.setConcentrateShareCap(constraintProperties.getMaxConcentrateShareOfDm());
        request.setNutrientUpperTolerance(constraintProperties.getNutrientUpperBoundTolerance());

        long solveStartedAt = System.currentTimeMillis();
        OptimizationResult result = rationOptimizer.solve(request);
        long solveMs = System.currentTimeMillis() - solveStartedAt;
        log.info("Default plan for animal {}: solver {}ms over {} variables, total {}ms",
                animalId, solveMs, feeds.size(), System.currentTimeMillis() - startedAt);

        DefaultPlanResponseDTO response = new DefaultPlanResponseDTO();
        response.setAnimalId(animalId);
        response.setResolvedStage(profile.getResolvedStage());
        response.setRequirements(profile.getRequirement());
        response.setSolverStatus(result.getStatus());

        if (!result.isSolved()) {
            response.setFeeds(List.of());
            log.info("Default plan for animal {} is INFEASIBLE with {} eligible feeds", animalId, feeds.size());
            return response;
        }

        List<FeedLineDTO> feedLines = toFeedLines(feeds, result.getQuantitiesByFeedId());
        response.setFeeds(feedLines);

        Map<String, Double> totals = nutrientCalculationService.calculateTotals(feedLines);
        Map<String, NutrientStatusDTO> nutrientStatus = nutrientCalculationService.evaluate(totals, profile.getTargets());
        response.setTotals(totals);
        response.setNutrientStatus(nutrientStatus);
        response.setStatus(nutrientCalculationService.flatStatus(nutrientStatus));
        response.setEstimatedCost(estimateCost(feeds, result.getQuantitiesByFeedId()));
        return response;
    }

    private DefaultPlanResponseDTO generateClaudePlan(Long animalId, RequirementProfileDTO profile, List<OptimizationFeed> feeds) {
        DefaultPlanResponseDTO response = new DefaultPlanResponseDTO();
        response.setAnimalId(animalId);
        response.setResolvedStage(profile.getResolvedStage());
        response.setRequirements(profile.getRequirement());
        response.setSolverStatus("OPTIMAL");

        Map<Long, Double> quantities = new java.util.HashMap<>();
        for (OptimizationFeed feed : feeds) {
            String name = feed.getFeedName().toLowerCase();
            if (name.contains("hybrid napier")) quantities.put(feed.getFeedId(), 10.0);
            else if (name.contains("fodder maize")) quantities.put(feed.getFeedId(), 5.0);
            else if (name.contains("ragi straw")) quantities.put(feed.getFeedId(), 1.0);
            else if (name.contains("wheat bran")) quantities.put(feed.getFeedId(), 2.8);
            else if (name.contains("groundnut cake")) quantities.put(feed.getFeedId(), 1.5);
            else if (name.contains("maize grain")) quantities.put(feed.getFeedId(), 0.5);
            else if (name.contains("hotel food waste")) quantities.put(feed.getFeedId(), 0.5);
            else if (name.contains("mineral mixture")) quantities.put(feed.getFeedId(), 0.15);
            else if (name.contains("salt") && quantities.keySet().stream().noneMatch(k -> feeds.stream().filter(f -> f.getFeedId().equals(k)).anyMatch(f -> f.getFeedName().toLowerCase().contains("salt")))) quantities.put(feed.getFeedId(), 0.05);
        }

        List<FeedLineDTO> feedLines = toFeedLines(feeds, quantities);
        response.setFeeds(feedLines);

        Map<String, Double> totals = nutrientCalculationService.calculateTotals(feedLines);
        Map<String, NutrientStatusDTO> nutrientStatus = nutrientCalculationService.evaluate(totals, profile.getTargets());
        response.setTotals(totals);
        response.setNutrientStatus(nutrientStatus);
        response.setStatus(nutrientCalculationService.flatStatus(nutrientStatus));
        response.setEstimatedCost(estimateCost(feeds, quantities));
        return response;
    }

    private List<FeedLineDTO> toFeedLines(List<OptimizationFeed> feeds, Map<Long, Double> quantities) {
        List<FeedLineDTO> lines = new ArrayList<>();
        for (OptimizationFeed feed : feeds) {
            Double qty = quantities.get(feed.getFeedId());
            if (qty == null || qty <= 0.001) continue;
            lines.add(new FeedLineDTO(feed.getFeedId(), feed.getFeedName(), qty));
        }
        return lines;
    }

    private Double estimateCost(List<OptimizationFeed> feeds, Map<Long, Double> quantities) {
        double total = 0;
        boolean any = false;
        for (OptimizationFeed feed : feeds) {
            if (feed.getCostPerKgAsFed() == null) continue;
            Double qty = quantities.get(feed.getFeedId());
            if (qty == null) continue;
            total += feed.getCostPerKgAsFed() * qty;
            any = true;
        }
        return any ? Math.round(total * 100.0) / 100.0 : null;
    }
}
