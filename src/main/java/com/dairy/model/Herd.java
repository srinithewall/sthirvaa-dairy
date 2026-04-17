package com.dairy.model;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

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
    
    @Column(name = "breed_type")
    private String breedType;

    @Column(name = "birth_date")
    private LocalDate birthDate;

    @Column(name = "procured_date")
    private LocalDate procuredDate;

    @Column(name = "is_calf")
    private Boolean isCalf;

    @Column(name = "is_lactating")
    private Boolean isLactating;

    @Column(name = "health_status")
    private String healthStatus;

    private String source;

    @Column(name = "image_url")
    private String imageUrl;

    @Column(nullable = false)
    private String status = "ACTIVE";

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

    public Boolean isCalf() { return isCalf; }
    public void setCalf(Boolean calf) { isCalf = calf; }

    public Boolean isLactating() { return isLactating; }
    public void setLactating(Boolean lactating) { isLactating = lactating; }

    public String getTagNumber() { return tagNumber; }
    public void setTagNumber(String tagNumber) { this.tagNumber = tagNumber; }

    public String getAnimalType() { return animalType; }
    public void setAnimalType(String animalType) { this.animalType = animalType; }

    public String getAnimalName() { return animalName; }
    public void setAnimalName(String animalName) { this.animalName = animalName; }

    public String getBreed() { return breed; }
    public void setBreed(String breed) { this.breed = breed; }

    public String getBreedType() { return breedType; }
    public void setBreedType(String breedType) { this.breedType = breedType; }

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

    @Transient
    public String getAge() {
        if (birthDate == null) return "N/A";
        java.time.Period period = java.time.Period.between(birthDate, java.time.LocalDate.now());
        if (period.getYears() > 0) return period.getYears() + "y " + period.getMonths() + "m";
        if (period.getMonths() > 0) return period.getMonths() + "m";
        return period.getDays() + "d";
    }
}
