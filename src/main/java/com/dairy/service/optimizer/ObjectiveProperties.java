package com.dairy.service.optimizer;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Centralized objective-function weights for the RationOptimizer (rule 8 of
 * the feed optimizer spec: "do not scatter objective weights throughout the
 * code"). Default Plan and Current Ration each get their own weight profile.
 * See application.properties (feed-optimizer.objective.*).
 */
@Component
@ConfigurationProperties(prefix = "feed-optimizer.objective")
public class ObjectiveProperties {
    private Profile defaultPlan = new Profile(1.0, 0.5, 0.0);
    private Profile currentRation = new Profile(0.3, 0.5, 2.0);
    private double changeEpsilonKg = 0.05;

    public Profile getDefaultPlan() { return defaultPlan; }
    public void setDefaultPlan(Profile defaultPlan) { this.defaultPlan = defaultPlan; }

    public Profile getCurrentRation() { return currentRation; }
    public void setCurrentRation(Profile currentRation) { this.currentRation = currentRation; }

    public double getChangeEpsilonKg() { return changeEpsilonKg; }
    public void setChangeEpsilonKg(double changeEpsilonKg) { this.changeEpsilonKg = changeEpsilonKg; }

    public static class Profile {
        private double costWeight;
        private double oversupplyWeight;
        private double changeWeight;

        public Profile() {}

        public Profile(double costWeight, double oversupplyWeight, double changeWeight) {
            this.costWeight = costWeight;
            this.oversupplyWeight = oversupplyWeight;
            this.changeWeight = changeWeight;
        }

        public double getCostWeight() { return costWeight; }
        public void setCostWeight(double costWeight) { this.costWeight = costWeight; }

        public double getOversupplyWeight() { return oversupplyWeight; }
        public void setOversupplyWeight(double oversupplyWeight) { this.oversupplyWeight = oversupplyWeight; }

        public double getChangeWeight() { return changeWeight; }
        public void setChangeWeight(double changeWeight) { this.changeWeight = changeWeight; }
    }
}
