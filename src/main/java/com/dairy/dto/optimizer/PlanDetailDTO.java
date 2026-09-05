package com.dairy.dto.optimizer;

import java.util.List;

/** GET /api/feed-plans/{planId} */
public class PlanDetailDTO {
    private Long id;
    private Long animalId;
    private String planName;
    private String planType;
    private List<FeedLineDTO> feeds;
    private Double totalEstimatedCost;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getAnimalId() { return animalId; }
    public void setAnimalId(Long animalId) { this.animalId = animalId; }

    public String getPlanName() { return planName; }
    public void setPlanName(String planName) { this.planName = planName; }

    public String getPlanType() { return planType; }
    public void setPlanType(String planType) { this.planType = planType; }

    public List<FeedLineDTO> getFeeds() { return feeds; }
    public void setFeeds(List<FeedLineDTO> feeds) { this.feeds = feeds; }

    public Double getTotalEstimatedCost() { return totalEstimatedCost; }
    public void setTotalEstimatedCost(Double totalEstimatedCost) { this.totalEstimatedCost = totalEstimatedCost; }
}
