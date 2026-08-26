package com.dairy.model;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import com.fasterxml.jackson.annotation.JsonFormat;

@Entity
@Table(name = "herds")
public class Herd {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tag_number", nullable = false, unique = true)
    private String tagNumber;

    @Column(name = "animal_type", nullable = false)
    private String animalType; // COW, BUFFALO, etc.

    @Column(name = "animal_name")
    private String animalName; // Lakshmi, Gowri, etc.

    private String breed;
    
    @Column(name = "milk_type")
    private String milkType;

    @Column(name = "birth_date")
    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate birthDate;

    @Column(name = "procured_date")
    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate procuredDate;

    @Column(name = "animal_status")
    private String animalStatus; // CALF, HEIFER, PREGNANT, LACTATING, DRY

    @Column(name = "health_status")
    private String healthStatus;

    private String source;

    @Column(name = "image_url")
    private String imageUrl;

    private String age;

    @Column(name = "heart_girth")
    private Double heartGirth;

    @Column(name = "mother_name")
    private String motherName;

    @Column(name = "father_semen")
    private String fatherSemen;

    @Column(nullable = false)
    private String status = "ACTIVE";

    // Computed / UI Fields
    @Transient
    private Double calculatedWeight;

    @Transient
    private String weightStatus;

    // Audit Fields (At the end)
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "created_by")
    private String createdBy;

    @Column(name = "updated_by")
    private String updatedBy;

    public Herd() {}

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

    public String getMilkType() { return milkType; }
    public void setMilkType(String milkType) { this.milkType = milkType; }

    public String getAnimalStatus() { return animalStatus; }
    public void setAnimalStatus(String animalStatus) { this.animalStatus = animalStatus; }

    public String getTagNumber() { return tagNumber; }
    public void setTagNumber(String tagNumber) { this.tagNumber = tagNumber; }

    public String getAnimalType() { return animalType; }
    public void setAnimalType(String animalType) { this.animalType = animalType; }

    public String getAnimalName() { return animalName; }
    public void setAnimalName(String animalName) { this.animalName = animalName; }

    public String getBreed() { return breed; }
    public void setBreed(String breed) { this.breed = breed; }


    public LocalDate getBirthDate() { return birthDate; }
    public void setBirthDate(LocalDate birthDate) { this.birthDate = birthDate; }

    public LocalDate getProcuredDate() { return procuredDate; }
    public void setProcuredDate(LocalDate procuredDate) { this.procuredDate = procuredDate; }

    public String getHealthStatus() { return healthStatus; }
    public void setHealthStatus(String healthStatus) { this.healthStatus = healthStatus; }

    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }

    public String getImageUrl() { return imageUrl; }
    public void setImageUrl(String imageUrl) { this.imageUrl = imageUrl; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }

    public String getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(String updatedBy) { this.updatedBy = updatedBy; }

    public String getAge() { return age; }
    public void setAge(String age) { this.age = age; }

    public Double getHeartGirth() { return heartGirth; }
    public void setHeartGirth(Double heartGirth) { this.heartGirth = heartGirth; }

    public String getMotherName() { return motherName; }
    public void setMotherName(String motherName) { this.motherName = motherName; }

    public String getFatherSemen() { return fatherSemen; }
    public void setFatherSemen(String fatherSemen) { this.fatherSemen = fatherSemen; }

    @Transient
    @com.fasterxml.jackson.annotation.JsonProperty("calculatedAge")
    public String getCalculatedAge() {
        if (birthDate == null) return "N/A";
        java.time.Period period = java.time.Period.between(birthDate, java.time.LocalDate.now());
        if (period.getYears() > 0) return period.getYears() + "y " + period.getMonths() + "m";
        if (period.getMonths() > 0) return period.getMonths() + "m";
        return period.getDays() + "d";
    }

    @Transient
    private Double avgMilk30Days;
    public Double getAvgMilk30Days() { return avgMilk30Days; }
    public void setAvgMilk30Days(Double avgMilk30Days) { this.avgMilk30Days = avgMilk30Days; }

    @Transient
    private Integer milkPotential;
    public Integer getMilkPotential() { return milkPotential; }
    public void setMilkPotential(Integer milkPotential) { this.milkPotential = milkPotential; }

    @Transient
    private String milkPotentialConfidence;
    public String getMilkPotentialConfidence() { return milkPotentialConfidence; }
    public void setMilkPotentialConfidence(String milkPotentialConfidence) { this.milkPotentialConfidence = milkPotentialConfidence; }

    @Transient
    private Integer lactationNumber;
    public Integer getLactationNumber() { return lactationNumber; }
    public void setLactationNumber(Integer lactationNumber) { this.lactationNumber = lactationNumber; }

    public Double getCalculatedWeight() { return calculatedWeight; }
    public void setCalculatedWeight(Double calculatedWeight) { this.calculatedWeight = calculatedWeight; }

    public String getWeightStatus() { return weightStatus; }
    public void setWeightStatus(String weightStatus) { this.weightStatus = weightStatus; }
}
