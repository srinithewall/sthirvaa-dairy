package com.dairy.service.optimizer;

import java.util.Map;

public class OptimizationResult {
    public static final String SOLVED = "SOLVED";
    public static final String INFEASIBLE = "INFEASIBLE";

    private String status;
    private Map<Long, Double> quantitiesByFeedId;

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public boolean isSolved() { return SOLVED.equals(status); }

    public Map<Long, Double> getQuantitiesByFeedId() { return quantitiesByFeedId; }
    public void setQuantitiesByFeedId(Map<Long, Double> quantitiesByFeedId) { this.quantitiesByFeedId = quantitiesByFeedId; }
}
