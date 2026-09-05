package com.dairy.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "feed_master")
public class FeedMaster {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "feed_name", nullable = false)
    private String feedName;

    @Column(name = "kannada_name")
    private String kannadaName;

    @Column(name = "tamil_name")
    private String tamilName;

    @Column(name = "scientific_name")
    private String scientificName;

    private String category;
    
    @Column(name = "feed_type")
    private String feedType;
    
    @Column(name = "growing_method")
    private String growingMethod;
    
    @Column(name = "hydroponic_suitable")
    private Boolean hydroponicSuitable;
    
    @Column(name = "tree_feed")
    private Boolean treeFeed;
    
    @Column(name = "aquatic_feed")
    private Boolean aquaticFeed;
    
    private String season;
    
    @Column(name = "days_to_harvest")
    private Integer daysToHarvest;
    
    @Column(name = "multi_cut")
    private Boolean multiCut;
    
    @Column(name = "approx_biomass_yield")
    private String approxBiomassYield;
    
    @Column(name = "palatability_rating")
    private Integer palatabilityRating;
    
    @Column(name = "cow_preference_rating")
    private Integer cowPreferenceRating;
    
    @Column(name = "cost_rating")
    private String costRating;
    
    @Column(name = "ease_of_growing_rating")
    private Integer easeOfGrowingRating;
    
    @Column(name = "suitable_for")
    private String suitableFor;
    
    @Column(columnDefinition = "TEXT")
    private String remarks;
    
    @Column(name = "image_url")
    private String imageUrl;
    
    @Column(name = "reference_source")
    private String referenceSource;

    private String status = "ACTIVE";

    // Feed Optimizer constraint fields (nullable - populated separately as real
    // data is entered; the optimizer treats null cost as "no cost contribution"
    // and null min/max as 0 / a configurable default ceiling, never a fabricated number).
    @Column(name = "cost_per_kg_as_fed")
    private Double costPerKgAsFed;

    @Column(name = "min_daily_qty_kg")
    private Double minDailyQtyKg;

    @Column(name = "max_daily_qty_kg")
    private Double maxDailyQtyKg;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public FeedMaster() {}

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

    public String getFeedName() { return feedName; }
    public void setFeedName(String feedName) { this.feedName = feedName; }

    public String getKannadaName() { return kannadaName; }
    public void setKannadaName(String kannadaName) { this.kannadaName = kannadaName; }

    public String getTamilName() { return tamilName; }
    public void setTamilName(String tamilName) { this.tamilName = tamilName; }

    public String getScientificName() { return scientificName; }
    public void setScientificName(String scientificName) { this.scientificName = scientificName; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getFeedType() { return feedType; }
    public void setFeedType(String feedType) { this.feedType = feedType; }

    public String getGrowingMethod() { return growingMethod; }
    public void setGrowingMethod(String growingMethod) { this.growingMethod = growingMethod; }

    public Boolean getHydroponicSuitable() { return hydroponicSuitable; }
    public void setHydroponicSuitable(Boolean hydroponicSuitable) { this.hydroponicSuitable = hydroponicSuitable; }

    public Boolean getTreeFeed() { return treeFeed; }
    public void setTreeFeed(Boolean treeFeed) { this.treeFeed = treeFeed; }

    public Boolean getAquaticFeed() { return aquaticFeed; }
    public void setAquaticFeed(Boolean aquaticFeed) { this.aquaticFeed = aquaticFeed; }

    public String getSeason() { return season; }
    public void setSeason(String season) { this.season = season; }

    public Integer getDaysToHarvest() { return daysToHarvest; }
    public void setDaysToHarvest(Integer daysToHarvest) { this.daysToHarvest = daysToHarvest; }

    public Boolean getMultiCut() { return multiCut; }
    public void setMultiCut(Boolean multiCut) { this.multiCut = multiCut; }

    public String getApproxBiomassYield() { return approxBiomassYield; }
    public void setApproxBiomassYield(String approxBiomassYield) { this.approxBiomassYield = approxBiomassYield; }

    public Integer getPalatabilityRating() { return palatabilityRating; }
    public void setPalatabilityRating(Integer palatabilityRating) { this.palatabilityRating = palatabilityRating; }

    public Integer getCowPreferenceRating() { return cowPreferenceRating; }
    public void setCowPreferenceRating(Integer cowPreferenceRating) { this.cowPreferenceRating = cowPreferenceRating; }

    public String getCostRating() { return costRating; }
    public void setCostRating(String costRating) { this.costRating = costRating; }

    public Integer getEaseOfGrowingRating() { return easeOfGrowingRating; }
    public void setEaseOfGrowingRating(Integer easeOfGrowingRating) { this.easeOfGrowingRating = easeOfGrowingRating; }

    public String getSuitableFor() { return suitableFor; }
    public void setSuitableFor(String suitableFor) { this.suitableFor = suitableFor; }

    public String getRemarks() { return remarks; }
    public void setRemarks(String remarks) { this.remarks = remarks; }

    public String getImageUrl() { return imageUrl; }
    public void setImageUrl(String imageUrl) { this.imageUrl = imageUrl; }

    public String getReferenceSource() { return referenceSource; }
    public void setReferenceSource(String referenceSource) { this.referenceSource = referenceSource; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Double getCostPerKgAsFed() { return costPerKgAsFed; }
    public void setCostPerKgAsFed(Double costPerKgAsFed) { this.costPerKgAsFed = costPerKgAsFed; }

    public Double getMinDailyQtyKg() { return minDailyQtyKg; }
    public void setMinDailyQtyKg(Double minDailyQtyKg) { this.minDailyQtyKg = minDailyQtyKg; }

    public Double getMaxDailyQtyKg() { return maxDailyQtyKg; }
    public void setMaxDailyQtyKg(Double maxDailyQtyKg) { this.maxDailyQtyKg = maxDailyQtyKg; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
