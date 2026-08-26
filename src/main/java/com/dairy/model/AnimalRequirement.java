package com.dairy.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "animal_requirements")
public class AnimalRequirement {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "animal_stage", nullable = false, unique = true)
    private String animalStage;

    private String breed;
    
    @Column(name = "body_weight_min")
    private Double bodyWeightMin;
    
    @Column(name = "body_weight_max")
    private Double bodyWeightMax;
    
    @Column(name = "milk_yield_min")
    private Double milkYieldMin;
    
    @Column(name = "milk_yield_max")
    private Double milkYieldMax;
    
    @Column(name = "dry_matter_intake")
    private Double dryMatterIntake; // kg/day
    
    @Column(name = "crude_protein_req")
    private Double crudeProteinReq; // kg or %
    
    @Column(name = "tdn_req")
    private Double tdnReq; // kg or %
    
    @Column(name = "me_req")
    private Double meReq; // MJ/day
    
    @Column(name = "calcium_req")
    private Double calciumReq; // grams
    
    @Column(name = "phosphorus_req")
    private Double phosphorusReq; // grams
    
    @Column(name = "magnesium_req")
    private Double magnesiumReq; // grams
    
    @Column(name = "fiber_req")
    private Double fiberReq; // %
    
    @Column(name = "water_req")
    private Double waterReq; // liters
    
    @Column(name = "mineral_req")
    private Double mineralReq; // grams
    
    @Column(columnDefinition = "TEXT")
    private String remarks;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public AnimalRequirement() {}

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

    public String getAnimalStage() { return animalStage; }
    public void setAnimalStage(String animalStage) { this.animalStage = animalStage; }

    public String getBreed() { return breed; }
    public void setBreed(String breed) { this.breed = breed; }

    public Double getBodyWeightMin() { return bodyWeightMin; }
    public void setBodyWeightMin(Double bodyWeightMin) { this.bodyWeightMin = bodyWeightMin; }

    public Double getBodyWeightMax() { return bodyWeightMax; }
    public void setBodyWeightMax(Double bodyWeightMax) { this.bodyWeightMax = bodyWeightMax; }

    public Double getMilkYieldMin() { return milkYieldMin; }
    public void setMilkYieldMin(Double milkYieldMin) { this.milkYieldMin = milkYieldMin; }

    public Double getMilkYieldMax() { return milkYieldMax; }
    public void setMilkYieldMax(Double milkYieldMax) { this.milkYieldMax = milkYieldMax; }

    public Double getDryMatterIntake() { return dryMatterIntake; }
    public void setDryMatterIntake(Double dryMatterIntake) { this.dryMatterIntake = dryMatterIntake; }

    public Double getCrudeProteinReq() { return crudeProteinReq; }
    public void setCrudeProteinReq(Double crudeProteinReq) { this.crudeProteinReq = crudeProteinReq; }

    public Double getTdnReq() { return tdnReq; }
    public void setTdnReq(Double tdnReq) { this.tdnReq = tdnReq; }

    public Double getMeReq() { return meReq; }
    public void setMeReq(Double meReq) { this.meReq = meReq; }

    public Double getCalciumReq() { return calciumReq; }
    public void setCalciumReq(Double calciumReq) { this.calciumReq = calciumReq; }

    public Double getPhosphorusReq() { return phosphorusReq; }
    public void setPhosphorusReq(Double phosphorusReq) { this.phosphorusReq = phosphorusReq; }

    public Double getMagnesiumReq() { return magnesiumReq; }
    public void setMagnesiumReq(Double magnesiumReq) { this.magnesiumReq = magnesiumReq; }

    public Double getFiberReq() { return fiberReq; }
    public void setFiberReq(Double fiberReq) { this.fiberReq = fiberReq; }

    public Double getWaterReq() { return waterReq; }
    public void setWaterReq(Double waterReq) { this.waterReq = waterReq; }

    public Double getMineralReq() { return mineralReq; }
    public void setMineralReq(Double mineralReq) { this.mineralReq = mineralReq; }

    public String getRemarks() { return remarks; }
    public void setRemarks(String remarks) { this.remarks = remarks; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
