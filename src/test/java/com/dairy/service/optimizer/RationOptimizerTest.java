package com.dairy.service.optimizer;

import com.dairy.model.FeedNutrition;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** No mocking here on purpose - exercises the real ojAlgo solver end to end. */
class RationOptimizerTest {

    private final RationOptimizer optimizer = new RationOptimizer();

    private OptimizationFeed feed(long id, String name, String category, boolean concentrate,
                                   double min, double max, Double cost,
                                   double dm, double cp, double tdn, double ca) {
        OptimizationFeed f = new OptimizationFeed();
        f.setFeedId(id);
        f.setFeedName(name);
        f.setCategory(category);
        f.setConcentrate(concentrate);
        f.setMinQtyKg(min);
        f.setMaxQtyKg(max);
        f.setCostPerKgAsFed(cost);
        FeedNutrition nut = new FeedNutrition();
        nut.setDryMatterPct(dm);
        nut.setCrudeProteinPct(cp);
        nut.setTdnPct(tdn);
        nut.setCalciumPct(ca);
        f.setNutrition(nut);
        return f;
    }

    private ObjectiveProperties.Profile profile(double cost, double oversupply, double change) {
        return new ObjectiveProperties.Profile(cost, oversupply, change);
    }

    private double totalNutrient(List<OptimizationFeed> feeds, Map<Long, Double> qty, String key) {
        double total = 0;
        for (OptimizationFeed f : feeds) {
            total += qty.getOrDefault(f.getFeedId(), 0.0) * NutrientMath.perKgContribution(f.getNutrition(), key);
        }
        return total;
    }

    @Test
    void solve_feasibleCase_meetsAllNutrientLowerBounds() {
        // Calcium % kept low (0.3/0.4) deliberately: at ~0.5%+ Ca even a pure-grass
        // ration hits ~75g Ca by the time DM=15kg is met, which would blow past a
        // 50g target with only 1.3x upper tolerance (65g cap) - i.e. genuinely infeasible.
        List<OptimizationFeed> feeds = List.of(
                feed(1L, "Grass", "Grass", false, 0, 40, 2.0, 90, 12, 55, 0.3),
                feed(2L, "Concentrate", "Concentrate", true, 0, 5, 20.0, 90, 30, 75, 0.4));

        Map<String, Double> targets = new LinkedHashMap<>();
        targets.put("DryMatter", 15.0);
        targets.put("CrudeProtein", 2.0);
        targets.put("TDN", 9.0);
        targets.put("Calcium", 50.0);

        OptimizationRequest request = new OptimizationRequest();
        request.setFeeds(feeds);
        request.setNutrientTargets(targets);
        request.setObjective(profile(1.0, 0.5, 0.0));
        request.setConcentrateShareCap(0.5);
        request.setNutrientUpperTolerance(1.3);

        OptimizationResult result = optimizer.solve(request);

        assertThat(result.isSolved()).isTrue();
        assertThat(totalNutrient(feeds, result.getQuantitiesByFeedId(), "DryMatter")).isGreaterThanOrEqualTo(15.0 - 0.01);
        assertThat(totalNutrient(feeds, result.getQuantitiesByFeedId(), "Calcium")).isGreaterThanOrEqualTo(50.0 - 0.01);
        assertThat(totalNutrient(feeds, result.getQuantitiesByFeedId(), "CrudeProtein")).isGreaterThanOrEqualTo(2.0 - 0.01);
        assertThat(totalNutrient(feeds, result.getQuantitiesByFeedId(), "TDN")).isGreaterThanOrEqualTo(9.0 - 0.01);
    }

    @Test
    void solve_infeasibleCase_returnsInfeasibleWithNoQuantities() {
        // A single feed capped at 1kg can never supply 100kg of dry matter.
        List<OptimizationFeed> feeds = List.of(
                feed(1L, "Grass", "Grass", false, 0, 1, 2.0, 90, 12, 55, 0.5));

        Map<String, Double> targets = new LinkedHashMap<>();
        targets.put("DryMatter", 100.0);

        OptimizationRequest request = new OptimizationRequest();
        request.setFeeds(feeds);
        request.setNutrientTargets(targets);
        request.setObjective(profile(1.0, 0.5, 0.0));
        request.setNutrientUpperTolerance(1.3);

        OptimizationResult result = optimizer.solve(request);

        assertThat(result.getStatus()).isEqualTo(OptimizationResult.INFEASIBLE);
        assertThat(result.getQuantitiesByFeedId()).isEmpty();
    }

    @Test
    void solve_respectsPerFeedMaxBound() {
        List<OptimizationFeed> feeds = List.of(
                feed(1L, "Concentrate", "Concentrate", true, 0, 3, 5.0, 90, 40, 80, 1.0),
                feed(2L, "Grass", "Grass", false, 0, 50, 1.0, 90, 12, 55, 0.5));

        Map<String, Double> targets = new LinkedHashMap<>();
        targets.put("DryMatter", 20.0);
        targets.put("CrudeProtein", 5.0); // pushes toward the high-protein concentrate

        OptimizationRequest request = new OptimizationRequest();
        request.setFeeds(feeds);
        request.setNutrientTargets(targets);
        request.setObjective(profile(0.1, 0.1, 0.0));
        request.setNutrientUpperTolerance(2.0);

        OptimizationResult result = optimizer.solve(request);

        assertThat(result.isSolved()).isTrue();
        assertThat(result.getQuantitiesByFeedId().get(1L)).isLessThanOrEqualTo(3.0 + 0.001);
    }

    @Test
    void solve_concentrateCap_limitsConcentrateShareOfDryMatter() {
        List<OptimizationFeed> feeds = List.of(
                feed(1L, "Concentrate", "Concentrate", true, 0, 50, 1.0, 90, 40, 80, 1.0),
                feed(2L, "Grass", "Grass", false, 0, 50, 1.0, 90, 12, 55, 0.5));

        Map<String, Double> targets = new LinkedHashMap<>();
        targets.put("DryMatter", 15.0);
        targets.put("CrudeProtein", 6.0); // would prefer an all-concentrate ration if unconstrained

        OptimizationRequest request = new OptimizationRequest();
        request.setFeeds(feeds);
        request.setNutrientTargets(targets);
        request.setObjective(profile(0.0, 0.0, 0.0));
        request.setConcentrateShareCap(0.3);
        request.setNutrientUpperTolerance(5.0);

        OptimizationResult result = optimizer.solve(request);

        assertThat(result.isSolved()).isTrue();
        double concentrateDm = result.getQuantitiesByFeedId().get(1L) * NutrientMath.dmFraction(feeds.get(0).getNutrition());
        double totalDm = totalNutrient(feeds, result.getQuantitiesByFeedId(), "DryMatter");
        assertThat(concentrateDm / totalDm).isLessThanOrEqualTo(0.31); // small slack for solver tolerance
    }

    @Test
    void solve_minimalChangeMode_prefersStayingCloseToBaselineWhenAlreadyAdequate() {
        List<OptimizationFeed> feeds = List.of(
                feed(1L, "Grass", "Grass", false, 0, 40, 2.0, 90, 12, 55, 0.5),
                feed(2L, "Concentrate", "Concentrate", true, 0, 10, 20.0, 90, 30, 75, 1.0));

        Map<String, Double> targets = new LinkedHashMap<>();
        targets.put("DryMatter", 15.0);
        targets.put("CrudeProtein", 2.0);

        Map<Long, Double> baseline = Map.of(1L, 18.0, 2L, 1.0); // already comfortably adequate

        OptimizationRequest request = new OptimizationRequest();
        request.setFeeds(feeds);
        request.setNutrientTargets(targets);
        request.setBaselineQtyByFeedId(baseline);
        request.setObjective(profile(0.3, 0.5, 5.0)); // heavy change penalty
        request.setNutrientUpperTolerance(2.0);

        OptimizationResult result = optimizer.solve(request);

        assertThat(result.isSolved()).isTrue();
        assertThat(result.getQuantitiesByFeedId().get(1L)).isCloseTo(18.0, org.assertj.core.data.Offset.offset(1.0));
        assertThat(result.getQuantitiesByFeedId().get(2L)).isCloseTo(1.0, org.assertj.core.data.Offset.offset(1.0));
    }
}
