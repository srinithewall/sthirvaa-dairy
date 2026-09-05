package com.dairy.dto.optimizer;

/** A single feed + daily quantity line, used across default-plan, custom-plan and ration result responses. */
public class FeedLineDTO {
    private Long feedId;
    private String feedName;
    private Double quantityKg;

    public FeedLineDTO() {}

    public FeedLineDTO(Long feedId, String feedName, Double quantityKg) {
        this.feedId = feedId;
        this.feedName = feedName;
        this.quantityKg = quantityKg;
    }

    public Long getFeedId() { return feedId; }
    public void setFeedId(Long feedId) { this.feedId = feedId; }

    public String getFeedName() { return feedName; }
    public void setFeedName(String feedName) { this.feedName = feedName; }

    public Double getQuantityKg() { return quantityKg; }
    public void setQuantityKg(Double quantityKg) { this.quantityKg = quantityKg; }
}
