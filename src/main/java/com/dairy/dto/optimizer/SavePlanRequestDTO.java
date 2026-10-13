package com.dairy.dto.optimizer;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public class SavePlanRequestDTO {
    /**
     * Legacy single-animal form, still accepted so callers written before shared plans
     * keep working. Prefer animalIds. When both are set they are unioned.
     */
    @Deprecated
    private Long animalId;

    /** Animals this plan applies to. May be empty, which creates an unassigned template. */
    private List<Long> animalIds;

    @NotBlank
    private String planName;

    @NotEmpty
    private List<FeedEntry> feedEntries;

    public Long getAnimalId() { return animalId; }
    public void setAnimalId(Long animalId) { this.animalId = animalId; }

    public List<Long> getAnimalIds() { return animalIds; }
    public void setAnimalIds(List<Long> animalIds) { this.animalIds = animalIds; }

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
