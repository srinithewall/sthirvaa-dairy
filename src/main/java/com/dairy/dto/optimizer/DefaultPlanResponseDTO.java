package com.dairy.dto.optimizer;

import com.dairy.model.AnimalRequirement;

import java.util.List;
import java.util.Map;

public class DefaultPlanResponseDTO {
    private Long animalId;
    private String planType = "DEFAULT";
    private String resolvedStage;
    private List<FeedLineDTO> feeds;
    private AnimalRequirement requirements;
    private Map<String, Double> totals;
    private Map<String, String> status;
    private Map<String, NutrientStatusDTO> nutrientStatus;
    private Double estimatedCost;
    private String solverStatus;

    public Long getAnimalId() { return animalId; }
    public void setAnimalId(Long animalId) { this.animalId = animalId; }

    public String getPlanType() { return planType; }
    public void setPlanType(String planType) { this.planType = planType; }

    public String getResolvedStage() { return resolvedStage; }
    public void setResolvedStage(String resolvedStage) { this.resolvedStage = resolvedStage; }

    public List<FeedLineDTO> getFeeds() { return feeds; }
    public void setFeeds(List<FeedLineDTO> feeds) { this.feeds = feeds; }

    public AnimalRequirement getRequirements() { return requirements; }
    public void setRequirements(AnimalRequirement requirements) { this.requirements = requirements; }

    public Map<String, Double> getTotals() { return totals; }
    public void setTotals(Map<String, Double> totals) { this.totals = totals; }

    public Map<String, String> getStatus() { return status; }
    public void setStatus(Map<String, String> status) { this.status = status; }

    public Map<String, NutrientStatusDTO> getNutrientStatus() { return nutrientStatus; }
    public void setNutrientStatus(Map<String, NutrientStatusDTO> nutrientStatus) { this.nutrientStatus = nutrientStatus; }

    public Double getEstimatedCost() { return estimatedCost; }
    public void setEstimatedCost(Double estimatedCost) { this.estimatedCost = estimatedCost; }

    public String getSolverStatus() { return solverStatus; }
    public void setSolverStatus(String solverStatus) { this.solverStatus = solverStatus; }
}
