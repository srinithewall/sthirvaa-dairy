package com.dairy.service.optimizer;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Feed-bound and ration-shape constraints applied by the RationOptimizer.
 * See application.properties (feed-optimizer.constraints.*).
 */
@Component
@ConfigurationProperties(prefix = "feed-optimizer.constraints")
public class ConstraintProperties {
    private double defaultMinQtyKg = 0;
    private double defaultMaxQtyKg = 50;
    private List<String> concentrateCategories = List.of("Concentrate", "Grain", "Byproduct");
    private double maxConcentrateShareOfDm = 0.5;
    private double nutrientUpperBoundTolerance = 1.3;

    public double getDefaultMinQtyKg() { return defaultMinQtyKg; }
    public void setDefaultMinQtyKg(double defaultMinQtyKg) { this.defaultMinQtyKg = defaultMinQtyKg; }

    public double getDefaultMaxQtyKg() { return defaultMaxQtyKg; }
    public void setDefaultMaxQtyKg(double defaultMaxQtyKg) { this.defaultMaxQtyKg = defaultMaxQtyKg; }

    public List<String> getConcentrateCategories() { return concentrateCategories; }
    public void setConcentrateCategories(List<String> concentrateCategories) { this.concentrateCategories = concentrateCategories; }

    public double getMaxConcentrateShareOfDm() { return maxConcentrateShareOfDm; }
    public void setMaxConcentrateShareOfDm(double maxConcentrateShareOfDm) { this.maxConcentrateShareOfDm = maxConcentrateShareOfDm; }

    public double getNutrientUpperBoundTolerance() { return nutrientUpperBoundTolerance; }
    public void setNutrientUpperBoundTolerance(double nutrientUpperBoundTolerance) { this.nutrientUpperBoundTolerance = nutrientUpperBoundTolerance; }

    public boolean isConcentrate(String category) {
        if (category == null) return false;
        return concentrateCategories.stream().anyMatch(c -> c.equalsIgnoreCase(category));
    }
}
