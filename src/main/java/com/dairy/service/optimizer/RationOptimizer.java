package com.dairy.service.optimizer;

import org.ojalgo.optimisation.Expression;
import org.ojalgo.optimisation.ExpressionsBasedModel;
import org.ojalgo.optimisation.Optimisation;
import org.ojalgo.optimisation.Variable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Constraint-based ration optimizer (rule 5/6 of the feed optimizer spec): every
 * eligible feed's daily quantity is one LP variable, bounded by its min/max; the
 * whole ration is solved simultaneously against nutrient lower/upper bounds and a
 * concentrate-share cap, minimizing a weighted objective (cost + oversupply, plus
 * an optional minimal-change term against a baseline ration). Backed by ojAlgo
 * (org.ojalgo:ojalgo), a pure-Java LP solver with no native dependencies.
 *
 * Minimal-change (Current Ration mode) is linearized the standard way: for each
 * feed, qty = baseline + increase - decrease (increase/decrease >= 0), and the
 * objective penalizes increase + decrease, which is exactly |qty - baseline| at
 * the optimum since driving both up simultaneously never helps minimize a sum.
 *
 * Never fabricates a solution: if the model is infeasible, returns
 * OptimizationResult.INFEASIBLE with no quantities rather than guessing.
 */
@Component
public class RationOptimizer {

    private static final Logger log = LoggerFactory.getLogger(RationOptimizer.class);

    public OptimizationResult solve(OptimizationRequest request) {
        ExpressionsBasedModel model = new ExpressionsBasedModel();
        boolean penalizeChange = request.getObjective().getChangeWeight() > 0;

        Map<Long, Variable> qtyVars = new LinkedHashMap<>();

        for (OptimizationFeed feed : request.getFeeds()) {
            double objectiveWeight = 0.0;
            if (feed.getCostPerKgAsFed() != null) {
                objectiveWeight += request.getObjective().getCostWeight() * feed.getCostPerKgAsFed();
            }
            for (Map.Entry<String, Double> target : request.getNutrientTargets().entrySet()) {
                Double required = target.getValue();
                if (required == null || required == 0) continue;
                double perKg = NutrientMath.perKgContribution(feed.getNutrition(), target.getKey());
                objectiveWeight += request.getObjective().getOversupplyWeight() * (perKg / required);
            }

            Variable qtyVar = model.addVariable("qty_" + feed.getFeedId())
                    .lower(feed.getMinQtyKg())
                    .upper(feed.getMaxQtyKg())
                    .weight(objectiveWeight);
            qtyVars.put(feed.getFeedId(), qtyVar);

            if (penalizeChange) {
                double baseline = request.getBaselineQtyByFeedId().getOrDefault(feed.getFeedId(), 0.0);

                Variable incVar = model.addVariable("inc_" + feed.getFeedId())
                        .lower(0).upper(feed.getMaxQtyKg())
                        .weight(request.getObjective().getChangeWeight());
                Variable decVar = model.addVariable("dec_" + feed.getFeedId())
                        .lower(0).upper(feed.getMaxQtyKg())
                        .weight(request.getObjective().getChangeWeight());

                // qty - inc + dec = baseline  <=>  qty = baseline + inc - dec
                Expression link = model.addExpression("link_" + feed.getFeedId()).level(baseline);
                link.set(qtyVar, 1).set(incVar, -1).set(decVar, 1);
            }
        }

        for (Map.Entry<String, Double> target : request.getNutrientTargets().entrySet()) {
            Double required = target.getValue();
            if (required == null || required == 0) continue; // no target set for this nutrient - don't constrain it

            Expression expr = model.addExpression("nutrient_" + target.getKey());
            for (OptimizationFeed feed : request.getFeeds()) {
                double coeff = NutrientMath.perKgContribution(feed.getNutrition(), target.getKey());
                if (coeff != 0.0) expr.set(qtyVars.get(feed.getFeedId()), coeff);
            }
            expr.lower(required);
            if (request.getNutrientUpperTolerance() > 0) {
                expr.upper(required * request.getNutrientUpperTolerance());
            }
        }

        if (request.getConcentrateShareCap() > 0 && request.getConcentrateShareCap() < 1) {
            Expression concentrateCap = model.addExpression("concentrate_cap").upper(0);
            for (OptimizationFeed feed : request.getFeeds()) {
                double dmPerKg = NutrientMath.dmFraction(feed.getNutrition());
                double coeff = feed.isConcentrate()
                        ? dmPerKg * (1 - request.getConcentrateShareCap())
                        : dmPerKg * (-request.getConcentrateShareCap());
                concentrateCap.set(qtyVars.get(feed.getFeedId()), coeff);
            }
        }

        Optimisation.Result result = model.minimise();

        OptimizationResult optimizationResult = new OptimizationResult();
        if (!result.getState().isFeasible()) {
            optimizationResult.setStatus(OptimizationResult.INFEASIBLE);
            optimizationResult.setQuantitiesByFeedId(Map.of());
            log.info("Ration optimization INFEASIBLE: {} feeds, targets={}", request.getFeeds().size(), request.getNutrientTargets());
            return optimizationResult;
        }

        Map<Long, Double> quantities = new LinkedHashMap<>();
        for (Map.Entry<Long, Variable> entry : qtyVars.entrySet()) {
            double value = result.doubleValue(model.indexOf(entry.getValue()));
            quantities.put(entry.getKey(), Math.round(value * 100.0) / 100.0);
        }
        optimizationResult.setStatus(OptimizationResult.SOLVED);
        optimizationResult.setQuantitiesByFeedId(quantities);
        log.info("Ration optimization SOLVED: {} feeds considered, {} nutrient targets, objective={}",
                request.getFeeds().size(), request.getNutrientTargets().size(), result.getValue());
        return optimizationResult;
    }
}
