package com.dairy.dto.optimizer;

import java.util.List;
import java.util.Map;

/** Feed lines + nutrient evaluation for one ration (current, default plan, or projected). */
public class RationResultDTO {
    private List<FeedLineDTO> feeds;
    private Map<String, Double> totals;
    private Map<String, String> status;
    private Map<String, NutrientStatusDTO> nutrientStatus;
    private Double estimatedCost;
    private String solverStatus; // SOLVED | INFEASIBLE | NOT_APPLICABLE (e.g. plain evaluation of a given ration, no solve involved)

    public List<FeedLineDTO> getFeeds() { return feeds; }
    public void setFeeds(List<FeedLineDTO> feeds) { this.feeds = feeds; }

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
