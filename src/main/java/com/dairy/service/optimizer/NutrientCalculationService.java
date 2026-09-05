package com.dairy.service.optimizer;

import com.dairy.dto.optimizer.FeedLineDTO;
import com.dairy.dto.optimizer.NutrientStatusDTO;
import com.dairy.exception.FeedNotFoundException;
import com.dairy.model.FeedNutrition;
import com.dairy.repository.FeedNutritionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Centralized nutrient math, shared by Default Plan and Current Ration so both
 * paths evaluate a ration identically. Convention (quantity is as-fed kg;
 * dryMatterPct converts it to DM kg; crudeProteinPct/tdnPct/calciumPct are then
 * read as a percentage OF that DM kg) is inherited unchanged from the existing
 * FeedOptimizerService.optimizeRation - not independently re-derived - so this
 * refactor doesn't silently change behavior. That convention itself is only an
 * assumption baked into the current code (no field/comment on FeedNutrition
 * documents as-fed vs. dry-matter basis); see docs/feed-optimizer-backend.md.
 *
 * To add a nutrient: add a case in accumulate() and a key in the targets map
 * built by AnimalRequirementResolutionService.
 */
@Service
public class NutrientCalculationService {

    @Autowired
    private FeedNutritionRepository feedNutritionRepository;

    private static final List<String> NUTRIENT_KEYS = List.of("DryMatter", "CrudeProtein", "TDN", "Calcium");

    public Map<String, Double> calculateTotals(List<FeedLineDTO> feedLines) {
        Map<String, Double> totals = new LinkedHashMap<>();
        for (String key : NUTRIENT_KEYS) totals.put(key, 0.0);

        // Fetch every feed's nutrition in one query rather than one per line.
        List<Long> feedIds = feedLines.stream()
                .filter(line -> line.getQuantityKg() != null && line.getQuantityKg() > 0)
                .map(FeedLineDTO::getFeedId)
                .distinct()
                .collect(Collectors.toList());

        if (feedIds.isEmpty()) {
            totals.replaceAll((key, value) -> round(value));
            return totals;
        }

        Map<Long, FeedNutrition> nutritionByFeedId = new HashMap<>();
        for (FeedNutrition nutrition : feedNutritionRepository.findByFeedMasterIdInWithFeedMaster(feedIds)) {
            nutritionByFeedId.put(nutrition.getFeedMaster().getId(), nutrition);
        }

        for (FeedLineDTO line : feedLines) {
            if (line.getQuantityKg() == null || line.getQuantityKg() <= 0) continue;

            FeedNutrition nut = nutritionByFeedId.get(line.getFeedId());
            // Unchanged contract: a feed line with no nutrition row is still a hard failure
            // rather than a silently-zero contribution.
            if (nut == null) throw new FeedNotFoundException(line.getFeedId());

            for (String key : NUTRIENT_KEYS) {
                double contribution = line.getQuantityKg() * NutrientMath.perKgContribution(nut, key);
                totals.merge(key, contribution, Double::sum);
            }
        }

        totals.replaceAll((key, value) -> round(value));
        return totals;
    }

    public Map<String, NutrientStatusDTO> evaluate(Map<String, Double> totals, Map<String, Double> targets) {
        Map<String, NutrientStatusDTO> result = new LinkedHashMap<>();
        for (Map.Entry<String, Double> entry : targets.entrySet()) {
            Double required = entry.getValue();
            Double current = totals.getOrDefault(entry.getKey(), 0.0);
            result.put(entry.getKey(), new NutrientStatusDTO(current, required, classify(current, required)));
        }
        return result;
    }

    public Map<String, String> flatStatus(Map<String, NutrientStatusDTO> nutrientStatus) {
        Map<String, String> flat = new LinkedHashMap<>();
        nutrientStatus.forEach((key, value) -> flat.put(key, value.getStatus()));
        return flat;
    }

    // Same 0.9/1.2 ratio bands as the current FeedOptimizerService - an inherited
    // convention, not a new invented threshold.
    private String classify(Double current, Double required) {
        if (required == null || required == 0) return "ADEQUATE";
        double ratio = current / required;
        if (ratio < 0.9) return "DEFICIENT";
        if (ratio > 1.2) return "EXCESS";
        return "ADEQUATE";
    }

    private double round(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}
