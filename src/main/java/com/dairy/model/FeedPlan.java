package com.dairy.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "feed_plans")
public class FeedPlan {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "herd_id", nullable = false)
    private Long herdId;

    @Column(name = "plan_name", nullable = false)
    private String planName;

    @Column(name = "plan_type", nullable = false)
    private String planType = "CUSTOM"; // only CUSTOM plans are ever persisted today - see docs/feed-optimizer-backend.md

    @Column(name = "total_estimated_cost")
    private Double totalEstimatedCost;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public FeedPlan() {}

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getHerdId() { return herdId; }
    public void setHerdId(Long herdId) { this.herdId = herdId; }

    public String getPlanName() { return planName; }
    public void setPlanName(String planName) { this.planName = planName; }

    public String getPlanType() { return planType; }
    public void setPlanType(String planType) { this.planType = planType; }

    public Double getTotalEstimatedCost() { return totalEstimatedCost; }
    public void setTotalEstimatedCost(Double totalEstimatedCost) { this.totalEstimatedCost = totalEstimatedCost; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
