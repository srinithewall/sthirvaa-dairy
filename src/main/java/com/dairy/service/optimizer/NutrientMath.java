package com.dairy.service.optimizer;

import com.dairy.model.FeedNutrition;

/**
 * Single source of truth for the as-fed-kg -> nutrient-contribution conversion,
 * used by both NutrientCalculationService (evaluating a given ration) and
 * RationOptimizer (building the solver's per-feed constraint coefficients) so
 * the two can never drift apart. Convention inherited unchanged from the
 * existing FeedOptimizerService.optimizeRation - see NutrientCalculationService
 * Javadoc for the caveat that this convention itself is an assumption, not a
 * documented fact of the Feed Master data.
 */
final class NutrientMath {

    private NutrientMath() {}

    static double dmFraction(FeedNutrition nut) {
        return (nut.getDryMatterPct() != null ? nut.getDryMatterPct() : 90.0) / 100.0;
    }

    /** Contribution of 1 kg-as-fed of this feed to the named nutrient, in the units NutrientCalculationService reports (kg for DryMatter/CrudeProtein/TDN, grams for Calcium). */
    static double perKgContribution(FeedNutrition nut, String nutrientKey) {
        double dm = dmFraction(nut);
        switch (nutrientKey) {
            case "DryMatter":
                return dm;
            case "CrudeProtein":
                return nut.getCrudeProteinPct() != null ? dm * (nut.getCrudeProteinPct() / 100.0) : 0.0;
            case "TDN":
                return nut.getTdnPct() != null ? dm * (nut.getTdnPct() / 100.0) : 0.0;
            case "Calcium":
                return nut.getCalciumPct() != null ? (dm * 1000) * (nut.getCalciumPct() / 100.0) : 0.0;
            default:
                return 0.0;
        }
    }
}
