package com.dairy.dto;

import java.util.List;

public class FeedOptimizerRequestDTO {
    // Primary going forward: real animal record drives requirement resolution
    // (breed/DIM/weight/pregnancy). animalStage below becomes an optional
    // override, only honored if it exactly matches a seeded AnimalRequirement row.
    private Long animalId;
    private String animalStage;
    private Double bodyWeight;
    private Double milkYield;
    private List<FeedEntry> feedEntries;

    public Long getAnimalId() { return animalId; }
    public void setAnimalId(Long animalId) { this.animalId = animalId; }

    public String getAnimalStage() { return animalStage; }
    public void setAnimalStage(String animalStage) { this.animalStage = animalStage; }

    public Double getBodyWeight() { return bodyWeight; }
    public void setBodyWeight(Double bodyWeight) { this.bodyWeight = bodyWeight; }

    public Double getMilkYield() { return milkYield; }
    public void setMilkYield(Double milkYield) { this.milkYield = milkYield; }

    public List<FeedEntry> getFeedEntries() { return feedEntries; }
    public void setFeedEntries(List<FeedEntry> feedEntries) { this.feedEntries = feedEntries; }

    public static class FeedEntry {
        private Long feedId;
        private Double quantityKg;

        public Long getFeedId() { return feedId; }
        public void setFeedId(Long feedId) { this.feedId = feedId; }

        public Double getQuantityKg() { return quantityKg; }
        public void setQuantityKg(Double quantityKg) { this.quantityKg = quantityKg; }
    }
}
