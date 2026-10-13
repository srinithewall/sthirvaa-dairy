package com.dairy.dto.optimizer;

import java.util.Map;

/**
 * How one plan's ration measures up for one specific animal.
 *
 * Plan quantities are absolute kilograms, but requirements are resolved per animal from
 * breed, weight, yield and stage - so the same ration can be ADEQUATE for one cow and
 * DEFICIENT for a higher-yielding one. This is what lets the assign screen show that
 * before a group is given an unsuitable ration.
 */
public class PlanAdequacyDTO {

    private Long animalId;
    private String animalName;
    private String tagNumber;
    private String resolvedStage;
    /** DEFICIENT if any nutrient is short, else EXCESS if any is over, else ADEQUATE. */
    private String overallStatus;
    private Map<String, NutrientStatusDTO> nutrientStatus;

    public Long getAnimalId() { return animalId; }
    public void setAnimalId(Long animalId) { this.animalId = animalId; }

    public String getAnimalName() { return animalName; }
    public void setAnimalName(String animalName) { this.animalName = animalName; }

    public String getTagNumber() { return tagNumber; }
    public void setTagNumber(String tagNumber) { this.tagNumber = tagNumber; }

    public String getResolvedStage() { return resolvedStage; }
    public void setResolvedStage(String resolvedStage) { this.resolvedStage = resolvedStage; }

    public String getOverallStatus() { return overallStatus; }
    public void setOverallStatus(String overallStatus) { this.overallStatus = overallStatus; }

    public Map<String, NutrientStatusDTO> getNutrientStatus() { return nutrientStatus; }
    public void setNutrientStatus(Map<String, NutrientStatusDTO> nutrientStatus) { this.nutrientStatus = nutrientStatus; }
}
