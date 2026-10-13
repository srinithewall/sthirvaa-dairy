package com.dairy.dto.optimizer;

import java.time.LocalDateTime;

/** One row of GET /api/feed-plans?animalId= */
public class PlanSummaryDTO {
    private Long id;
    private String planName;
    private String planType;
    private Double totalEstimatedCost;
    private LocalDateTime updatedAt;
    /** How many animals this plan is assigned to. */
    private int assignmentCount;

    public PlanSummaryDTO() {}

    public PlanSummaryDTO(Long id, String planName, String planType, Double totalEstimatedCost, LocalDateTime updatedAt) {
        this.id = id;
        this.planName = planName;
        this.planType = planType;
        this.totalEstimatedCost = totalEstimatedCost;
        this.updatedAt = updatedAt;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getPlanName() { return planName; }
    public void setPlanName(String planName) { this.planName = planName; }

    public String getPlanType() { return planType; }
    public void setPlanType(String planType) { this.planType = planType; }

    public Double getTotalEstimatedCost() { return totalEstimatedCost; }
    public void setTotalEstimatedCost(Double totalEstimatedCost) { this.totalEstimatedCost = totalEstimatedCost; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public int getAssignmentCount() { return assignmentCount; }
    public void setAssignmentCount(int assignmentCount) { this.assignmentCount = assignmentCount; }
}
