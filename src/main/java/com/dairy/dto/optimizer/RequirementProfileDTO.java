package com.dairy.dto.optimizer;

import com.dairy.model.AnimalRequirement;

import java.util.Map;

/**
 * Result of AnimalRequirementResolutionService: which AnimalRequirement row was
 * matched, which stage key it was resolved to, and a flattened nutrient-target
 * map (extensible - add a key here and to NutrientCalculationService to support
 * a new nutrient end to end).
 */
public class RequirementProfileDTO {
    private String resolvedStage;
    private boolean stageOverridden;
    private AnimalRequirement requirement;
    private Map<String, Double> targets; // e.g. DryMatter, CrudeProtein, TDN, Calcium

    public String getResolvedStage() { return resolvedStage; }
    public void setResolvedStage(String resolvedStage) { this.resolvedStage = resolvedStage; }

    public boolean isStageOverridden() { return stageOverridden; }
    public void setStageOverridden(boolean stageOverridden) { this.stageOverridden = stageOverridden; }

    public AnimalRequirement getRequirement() { return requirement; }
    public void setRequirement(AnimalRequirement requirement) { this.requirement = requirement; }

    public Map<String, Double> getTargets() { return targets; }
    public void setTargets(Map<String, Double> targets) { this.targets = targets; }
}
