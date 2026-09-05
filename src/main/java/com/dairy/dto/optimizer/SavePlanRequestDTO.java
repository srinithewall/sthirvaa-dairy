package com.dairy.dto.optimizer;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public class SavePlanRequestDTO {
    @NotNull
    private Long animalId;

    @NotBlank
    private String planName;

    @NotEmpty
    private List<FeedEntry> feedEntries;

    public Long getAnimalId() { return animalId; }
    public void setAnimalId(Long animalId) { this.animalId = animalId; }

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
