package com.dairy.dto.optimizer;

import java.util.List;

/** GET /api/feed-plans/{planId} */
public class PlanDetailDTO {
    private Long id;
    /**
     * First assigned animal. Ambiguous now that a plan can serve several - kept only so
     * existing callers do not break. Read assignments instead.
     */
    @Deprecated
    private Long animalId;
    private List<PlanAssignmentDTO> assignments;
    private int assignmentCount;
    private String planName;
    private String planType;
    private List<FeedLineDTO> feeds;
    private Double totalEstimatedCost;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getAnimalId() { return animalId; }
    public void setAnimalId(Long animalId) { this.animalId = animalId; }

    public List<PlanAssignmentDTO> getAssignments() { return assignments; }
    public void setAssignments(List<PlanAssignmentDTO> assignments) { this.assignments = assignments; }

    public int getAssignmentCount() { return assignmentCount; }
    public void setAssignmentCount(int assignmentCount) { this.assignmentCount = assignmentCount; }

    public String getPlanName() { return planName; }
    public void setPlanName(String planName) { this.planName = planName; }

    public String getPlanType() { return planType; }
    public void setPlanType(String planType) { this.planType = planType; }

    public List<FeedLineDTO> getFeeds() { return feeds; }
    public void setFeeds(List<FeedLineDTO> feeds) { this.feeds = feeds; }

    public Double getTotalEstimatedCost() { return totalEstimatedCost; }
    public void setTotalEstimatedCost(Double totalEstimatedCost) { this.totalEstimatedCost = totalEstimatedCost; }
}
