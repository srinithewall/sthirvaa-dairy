package com.dairy.model;

import jakarta.persistence.*;

@Entity
@Table(name = "feed_plan_items")
public class FeedPlanItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "feed_plan_id", nullable = false)
    private Long feedPlanId;

    @Column(name = "feed_id", nullable = false)
    private Long feedId;

    @Column(name = "quantity_kg", nullable = false)
    private Double quantityKg;

    public FeedPlanItem() {}

    public FeedPlanItem(Long feedPlanId, Long feedId, Double quantityKg) {
        this.feedPlanId = feedPlanId;
        this.feedId = feedId;
        this.quantityKg = quantityKg;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getFeedPlanId() { return feedPlanId; }
    public void setFeedPlanId(Long feedPlanId) { this.feedPlanId = feedPlanId; }

    public Long getFeedId() { return feedId; }
    public void setFeedId(Long feedId) { this.feedId = feedId; }

    public Double getQuantityKg() { return quantityKg; }
    public void setQuantityKg(Double quantityKg) { this.quantityKg = quantityKg; }
}
