package com.dairy.dto;

import com.dairy.model.AnimalRequirement;
import java.util.Map;
import java.util.List;

public class FeedOptimizerResponseDTO {
    private AnimalRequirement requirements;
    private Map<String, Double> totals;
    private Map<String, String> status;
    private List<String> recommendations;

    public AnimalRequirement getRequirements() { return requirements; }
    public void setRequirements(AnimalRequirement requirements) { this.requirements = requirements; }

    public Map<String, Double> getTotals() { return totals; }
    public void setTotals(Map<String, Double> totals) { this.totals = totals; }

    public Map<String, String> getStatus() { return status; }
    public void setStatus(Map<String, String> status) { this.status = status; }

    public List<String> getRecommendations() { return recommendations; }
    public void setRecommendations(List<String> recommendations) { this.recommendations = recommendations; }
}
