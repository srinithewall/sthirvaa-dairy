package com.dairy.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "feed_knowledge")
public class FeedKnowledge {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne
    @JoinColumn(name = "feed_id", nullable = false)
    @JsonIgnore
    private FeedMaster feedMaster;

    @Column(columnDefinition = "TEXT")
    private String description;
    
    @Column(columnDefinition = "TEXT")
    private String advantages;
    
    @Column(columnDefinition = "TEXT")
    private String disadvantages;
    
    @Column(name = "how_to_grow", columnDefinition = "TEXT")
    private String howToGrow;
    
    @Column(name = "harvest_stage", columnDefinition = "TEXT")
    private String harvestStage;
    
    @Column(name = "storage_method", columnDefinition = "TEXT")
    private String storageMethod;
    
    @Column(name = "hydroponic_notes", columnDefinition = "TEXT")
    private String hydroponicNotes;
    
    @Column(name = "suitable_animals", columnDefinition = "TEXT")
    private String suitableAnimals;
    
    @Column(name = "max_feeding_qty", columnDefinition = "TEXT")
    private String maxFeedingQty;
    
    @Column(columnDefinition = "TEXT")
    private String warnings;
    
    @Column(columnDefinition = "TEXT")
    private String referencesInfo;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public FeedKnowledge() {}

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public FeedMaster getFeedMaster() { return feedMaster; }
    public void setFeedMaster(FeedMaster feedMaster) { this.feedMaster = feedMaster; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getAdvantages() { return advantages; }
    public void setAdvantages(String advantages) { this.advantages = advantages; }

    public String getDisadvantages() { return disadvantages; }
    public void setDisadvantages(String disadvantages) { this.disadvantages = disadvantages; }

    public String getHowToGrow() { return howToGrow; }
    public void setHowToGrow(String howToGrow) { this.howToGrow = howToGrow; }

    public String getHarvestStage() { return harvestStage; }
    public void setHarvestStage(String harvestStage) { this.harvestStage = harvestStage; }

    public String getStorageMethod() { return storageMethod; }
    public void setStorageMethod(String storageMethod) { this.storageMethod = storageMethod; }

    public String getHydroponicNotes() { return hydroponicNotes; }
    public void setHydroponicNotes(String hydroponicNotes) { this.hydroponicNotes = hydroponicNotes; }

    public String getSuitableAnimals() { return suitableAnimals; }
    public void setSuitableAnimals(String suitableAnimals) { this.suitableAnimals = suitableAnimals; }

    public String getMaxFeedingQty() { return maxFeedingQty; }
    public void setMaxFeedingQty(String maxFeedingQty) { this.maxFeedingQty = maxFeedingQty; }

    public String getWarnings() { return warnings; }
    public void setWarnings(String warnings) { this.warnings = warnings; }

    public String getReferencesInfo() { return referencesInfo; }
    public void setReferencesInfo(String referencesInfo) { this.referencesInfo = referencesInfo; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
