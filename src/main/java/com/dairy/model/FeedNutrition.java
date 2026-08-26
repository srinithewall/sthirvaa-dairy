package com.dairy.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "feed_nutrition")
public class FeedNutrition {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne
    @JoinColumn(name = "feed_id", nullable = false)
    @JsonIgnore
    private FeedMaster feedMaster;

    @Column(name = "dry_matter_pct")
    private Double dryMatterPct;
    
    @Column(name = "moisture_pct")
    private Double moisturePct;
    
    @Column(name = "crude_protein_pct")
    private Double crudeProteinPct;
    
    @Column(name = "crude_fiber_pct")
    private Double crudeFiberPct;
    
    @Column(name = "ndf_pct")
    private Double ndfPct;
    
    @Column(name = "adf_pct")
    private Double adfPct;
    
    @Column(name = "tdn_pct")
    private Double tdnPct;
    
    @Column(name = "metabolizable_energy")
    private Double metabolizableEnergy; // MJ/kg
    
    @Column(name = "net_energy_lactation")
    private Double netEnergyLactation;
    
    @Column(name = "calcium_pct")
    private Double calciumPct;
    
    @Column(name = "phosphorus_pct")
    private Double phosphorusPct;
    
    @Column(name = "potassium_pct")
    private Double potassiumPct;
    
    @Column(name = "magnesium_pct")
    private Double magnesiumPct;
    
    @Column(name = "sodium_pct")
    private Double sodiumPct;
    
    @Column(name = "sulphur_pct")
    private Double sulphurPct;

    private Double iron;
    private Double copper;
    private Double zinc;
    private Double manganese;
    private Double selenium;

    @Column(name = "vitamin_a")
    private Double vitaminA;
    
    @Column(name = "vitamin_d")
    private Double vitaminD;
    
    @Column(name = "vitamin_e")
    private Double vitaminE;

    @Column(name = "digestibility_pct")
    private Double digestibilityPct;
    
    @Column(name = "relative_feed_value")
    private Double relativeFeedValue;
    
    @Column(name = "milk_yield_rating")
    private Integer milkYieldRating;
    
    @Column(name = "milk_fat_rating")
    private Integer milkFatRating;
    
    @Column(name = "protein_rating")
    private Integer proteinRating;
    
    @Column(name = "energy_rating")
    private Integer energyRating;
    
    @Column(name = "fiber_rating")
    private Integer fiberRating;
    
    @Column(name = "calcium_rating")
    private Integer calciumRating;

    @Column(name = "primary_nutrient")
    private String primaryNutrient;
    
    @Column(name = "nutrition_rating")
    private String nutritionRating;

    @Column(name = "max_feeding_limit")
    private String maxFeedingLimit;
    
    @Column(name = "anti_nutritional_factors")
    private String antiNutritionalFactors;
    
    @Column(name = "toxicity_risk")
    private String toxicityRisk;
    
    @Column(name = "recommended_animal_types")
    private String recommendedAnimalTypes;
    
    @Column(columnDefinition = "TEXT")
    private String remarks;
    
    @Column(name = "reference_source")
    private String referenceSource;
    
    @Column(name = "confidence_level")
    private String confidenceLevel;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public FeedNutrition() {}

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

    public Double getDryMatterPct() { return dryMatterPct; }
    public void setDryMatterPct(Double dryMatterPct) { this.dryMatterPct = dryMatterPct; }

    public Double getMoisturePct() { return moisturePct; }
    public void setMoisturePct(Double moisturePct) { this.moisturePct = moisturePct; }

    public Double getCrudeProteinPct() { return crudeProteinPct; }
    public void setCrudeProteinPct(Double crudeProteinPct) { this.crudeProteinPct = crudeProteinPct; }

    public Double getCrudeFiberPct() { return crudeFiberPct; }
    public void setCrudeFiberPct(Double crudeFiberPct) { this.crudeFiberPct = crudeFiberPct; }

    public Double getNdfPct() { return ndfPct; }
    public void setNdfPct(Double ndfPct) { this.ndfPct = ndfPct; }

    public Double getAdfPct() { return adfPct; }
    public void setAdfPct(Double adfPct) { this.adfPct = adfPct; }

    public Double getTdnPct() { return tdnPct; }
    public void setTdnPct(Double tdnPct) { this.tdnPct = tdnPct; }

    public Double getMetabolizableEnergy() { return metabolizableEnergy; }
    public void setMetabolizableEnergy(Double metabolizableEnergy) { this.metabolizableEnergy = metabolizableEnergy; }

    public Double getNetEnergyLactation() { return netEnergyLactation; }
    public void setNetEnergyLactation(Double netEnergyLactation) { this.netEnergyLactation = netEnergyLactation; }

    public Double getCalciumPct() { return calciumPct; }
    public void setCalciumPct(Double calciumPct) { this.calciumPct = calciumPct; }

    public Double getPhosphorusPct() { return phosphorusPct; }
    public void setPhosphorusPct(Double phosphorusPct) { this.phosphorusPct = phosphorusPct; }

    public Double getPotassiumPct() { return potassiumPct; }
    public void setPotassiumPct(Double potassiumPct) { this.potassiumPct = potassiumPct; }

    public Double getMagnesiumPct() { return magnesiumPct; }
    public void setMagnesiumPct(Double magnesiumPct) { this.magnesiumPct = magnesiumPct; }

    public Double getSodiumPct() { return sodiumPct; }
    public void setSodiumPct(Double sodiumPct) { this.sodiumPct = sodiumPct; }

    public Double getSulphurPct() { return sulphurPct; }
    public void setSulphurPct(Double sulphurPct) { this.sulphurPct = sulphurPct; }

    public Double getIron() { return iron; }
    public void setIron(Double iron) { this.iron = iron; }

    public Double getCopper() { return copper; }
    public void setCopper(Double copper) { this.copper = copper; }

    public Double getZinc() { return zinc; }
    public void setZinc(Double zinc) { this.zinc = zinc; }

    public Double getManganese() { return manganese; }
    public void setManganese(Double manganese) { this.manganese = manganese; }

    public Double getSelenium() { return selenium; }
    public void setSelenium(Double selenium) { this.selenium = selenium; }

    public Double getVitaminA() { return vitaminA; }
    public void setVitaminA(Double vitaminA) { this.vitaminA = vitaminA; }

    public Double getVitaminD() { return vitaminD; }
    public void setVitaminD(Double vitaminD) { this.vitaminD = vitaminD; }

    public Double getVitaminE() { return vitaminE; }
    public void setVitaminE(Double vitaminE) { this.vitaminE = vitaminE; }

    public Double getDigestibilityPct() { return digestibilityPct; }
    public void setDigestibilityPct(Double digestibilityPct) { this.digestibilityPct = digestibilityPct; }

    public Double getRelativeFeedValue() { return relativeFeedValue; }
    public void setRelativeFeedValue(Double relativeFeedValue) { this.relativeFeedValue = relativeFeedValue; }

    public Integer getMilkYieldRating() { return milkYieldRating; }
    public void setMilkYieldRating(Integer milkYieldRating) { this.milkYieldRating = milkYieldRating; }

    public Integer getMilkFatRating() { return milkFatRating; }
    public void setMilkFatRating(Integer milkFatRating) { this.milkFatRating = milkFatRating; }

    public Integer getProteinRating() { return proteinRating; }
    public void setProteinRating(Integer proteinRating) { this.proteinRating = proteinRating; }

    public Integer getEnergyRating() { return energyRating; }
    public void setEnergyRating(Integer energyRating) { this.energyRating = energyRating; }

    public Integer getFiberRating() { return fiberRating; }
    public void setFiberRating(Integer fiberRating) { this.fiberRating = fiberRating; }

    public Integer getCalciumRating() { return calciumRating; }
    public void setCalciumRating(Integer calciumRating) { this.calciumRating = calciumRating; }

    public String getPrimaryNutrient() { return primaryNutrient; }
    public void setPrimaryNutrient(String primaryNutrient) { this.primaryNutrient = primaryNutrient; }

    public String getNutritionRating() { return nutritionRating; }
    public void setNutritionRating(String nutritionRating) { this.nutritionRating = nutritionRating; }

    public String getMaxFeedingLimit() { return maxFeedingLimit; }
    public void setMaxFeedingLimit(String maxFeedingLimit) { this.maxFeedingLimit = maxFeedingLimit; }

    public String getAntiNutritionalFactors() { return antiNutritionalFactors; }
    public void setAntiNutritionalFactors(String antiNutritionalFactors) { this.antiNutritionalFactors = antiNutritionalFactors; }

    public String getToxicityRisk() { return toxicityRisk; }
    public void setToxicityRisk(String toxicityRisk) { this.toxicityRisk = toxicityRisk; }

    public String getRecommendedAnimalTypes() { return recommendedAnimalTypes; }
    public void setRecommendedAnimalTypes(String recommendedAnimalTypes) { this.recommendedAnimalTypes = recommendedAnimalTypes; }

    public String getRemarks() { return remarks; }
    public void setRemarks(String remarks) { this.remarks = remarks; }

    public String getReferenceSource() { return referenceSource; }
    public void setReferenceSource(String referenceSource) { this.referenceSource = referenceSource; }

    public String getConfidenceLevel() { return confidenceLevel; }
    public void setConfidenceLevel(String confidenceLevel) { this.confidenceLevel = confidenceLevel; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
