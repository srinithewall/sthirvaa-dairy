package com.dairy.dto;

import com.dairy.dto.optimizer.FeedAdjustmentDTO;
import com.dairy.dto.optimizer.NutrientStatusDTO;
import com.dairy.dto.optimizer.RationResultDTO;
import com.dairy.model.AnimalRequirement;
import java.util.Map;
import java.util.List;

public class FeedOptimizerResponseDTO {
    // Existing fields - kept as-is, the current frontend build reads these directly.
    private AnimalRequirement requirements;
    private Map<String, Double> totals;
    private Map<String, String> status;
    private List<String> recommendations;

    // New fields - real constraint-based optimizer output (rules 10-14).
    private String resolvedStage;
    private Map<String, NutrientStatusDTO> nutrientStatus;
    private List<FeedAdjustmentDTO> addRecommendations;
    private List<FeedAdjustmentDTO> reduceRecommendations;
    private RationResultDTO projected;
    private String finalStatus;
    private String solverStatus;

    public AnimalRequirement getRequirements() { return requirements; }
    public void setRequirements(AnimalRequirement requirements) { this.requirements = requirements; }

    public Map<String, Double> getTotals() { return totals; }
    public void setTotals(Map<String, Double> totals) { this.totals = totals; }

    public Map<String, String> getStatus() { return status; }
    public void setStatus(Map<String, String> status) { this.status = status; }

    public List<String> getRecommendations() { return recommendations; }
    public void setRecommendations(List<String> recommendations) { this.recommendations = recommendations; }

    public String getResolvedStage() { return resolvedStage; }
    public void setResolvedStage(String resolvedStage) { this.resolvedStage = resolvedStage; }

    public Map<String, NutrientStatusDTO> getNutrientStatus() { return nutrientStatus; }
    public void setNutrientStatus(Map<String, NutrientStatusDTO> nutrientStatus) { this.nutrientStatus = nutrientStatus; }

    public List<FeedAdjustmentDTO> getAddRecommendations() { return addRecommendations; }
    public void setAddRecommendations(List<FeedAdjustmentDTO> addRecommendations) { this.addRecommendations = addRecommendations; }

    public List<FeedAdjustmentDTO> getReduceRecommendations() { return reduceRecommendations; }
    public void setReduceRecommendations(List<FeedAdjustmentDTO> reduceRecommendations) { this.reduceRecommendations = reduceRecommendations; }

    public RationResultDTO getProjected() { return projected; }
    public void setProjected(RationResultDTO projected) { this.projected = projected; }

    public String getFinalStatus() { return finalStatus; }
    public void setFinalStatus(String finalStatus) { this.finalStatus = finalStatus; }

    public String getSolverStatus() { return solverStatus; }
    public void setSolverStatus(String solverStatus) { this.solverStatus = solverStatus; }
}
