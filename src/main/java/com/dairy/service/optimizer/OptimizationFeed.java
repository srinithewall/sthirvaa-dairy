package com.dairy.service.optimizer;

import com.dairy.model.FeedNutrition;

/** A feed as seen by the solver: id/name/category plus resolved bounds, cost and nutrition. */
public class OptimizationFeed {
    private Long feedId;
    private String feedName;
    private String category;
    private boolean concentrate;
    private double minQtyKg;
    private double maxQtyKg;
    private Double costPerKgAsFed;
    private FeedNutrition nutrition;

    public Long getFeedId() { return feedId; }
    public void setFeedId(Long feedId) { this.feedId = feedId; }

    public String getFeedName() { return feedName; }
    public void setFeedName(String feedName) { this.feedName = feedName; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public boolean isConcentrate() { return concentrate; }
    public void setConcentrate(boolean concentrate) { this.concentrate = concentrate; }

    public double getMinQtyKg() { return minQtyKg; }
    public void setMinQtyKg(double minQtyKg) { this.minQtyKg = minQtyKg; }

    public double getMaxQtyKg() { return maxQtyKg; }
    public void setMaxQtyKg(double maxQtyKg) { this.maxQtyKg = maxQtyKg; }

    public Double getCostPerKgAsFed() { return costPerKgAsFed; }
    public void setCostPerKgAsFed(Double costPerKgAsFed) { this.costPerKgAsFed = costPerKgAsFed; }

    public FeedNutrition getNutrition() { return nutrition; }
    public void setNutrition(FeedNutrition nutrition) { this.nutrition = nutrition; }
}
