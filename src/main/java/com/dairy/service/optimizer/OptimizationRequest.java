package com.dairy.service.optimizer;

import java.util.List;
import java.util.Map;

/** Everything RationOptimizer needs to build and solve one LP model. */
public class OptimizationRequest {
    private List<OptimizationFeed> feeds;
    private Map<String, Double> nutrientTargets;
    private Map<Long, Double> baselineQtyByFeedId = Map.of(); // empty/zero => Default Plan mode
    private ObjectiveProperties.Profile objective;
    private double concentrateShareCap;
    private double nutrientUpperTolerance;

    public List<OptimizationFeed> getFeeds() { return feeds; }
    public void setFeeds(List<OptimizationFeed> feeds) { this.feeds = feeds; }

    public Map<String, Double> getNutrientTargets() { return nutrientTargets; }
    public void setNutrientTargets(Map<String, Double> nutrientTargets) { this.nutrientTargets = nutrientTargets; }

    public Map<Long, Double> getBaselineQtyByFeedId() { return baselineQtyByFeedId; }
    public void setBaselineQtyByFeedId(Map<Long, Double> baselineQtyByFeedId) { this.baselineQtyByFeedId = baselineQtyByFeedId; }

    public ObjectiveProperties.Profile getObjective() { return objective; }
    public void setObjective(ObjectiveProperties.Profile objective) { this.objective = objective; }

    public double getConcentrateShareCap() { return concentrateShareCap; }
    public void setConcentrateShareCap(double concentrateShareCap) { this.concentrateShareCap = concentrateShareCap; }

    public double getNutrientUpperTolerance() { return nutrientUpperTolerance; }
    public void setNutrientUpperTolerance(double nutrientUpperTolerance) { this.nutrientUpperTolerance = nutrientUpperTolerance; }
}
