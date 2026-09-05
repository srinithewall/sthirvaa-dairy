package com.dairy.dto.optimizer;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;

/**
 * PUT /api/feed-plans/{planId}.
 *
 * Carries the COMPLETE replacement ration: feedEntries are applied wholesale rather than
 * merged, so a line omitted here is removed from the plan.
 *
 * Deliberately has no animalId - editing a plan must not silently move it to a different
 * animal. Reassignment gets its own endpoint when shared plans land (see
 * docs/feed-plans-v2-spec.md).
 */
public class UpdatePlanRequestDTO {

    @NotBlank
    private String planName;

    @NotEmpty
    private List<FeedEntry> feedEntries;

    public String getPlanName() { return planName; }
    public void setPlanName(String planName) { this.planName = planName; }

    public List<FeedEntry> getFeedEntries() { return feedEntries; }
    public void setFeedEntries(List<FeedEntry> feedEntries) { this.feedEntries = feedEntries; }

    public static class FeedEntry {
        @NotNull
        private Long feedId;
        @NotNull
        private Double quantityKg;

        public Long getFeedId() { return feedId; }
        public void setFeedId(Long feedId) { this.feedId = feedId; }

        public Double getQuantityKg() { return quantityKg; }
        public void setQuantityKg(Double quantityKg) { this.quantityKg = quantityKg; }
    }
}
