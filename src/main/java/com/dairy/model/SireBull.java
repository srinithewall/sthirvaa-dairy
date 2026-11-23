package com.dairy.model;

import jakarta.persistence.*;

/**
 * A breeding bull whose semen is used for AI on the farm (e.g. HF-40421 "Tayson" from
 * Alamadhi Semen Station). Pedigree yields are the semen station's published figures,
 * in kg per best lactation.
 */
@Entity
@Table(name = "sire_bulls")
public class SireBull {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Station bull number, normalised upper case, e.g. "HF-40421". */
    @Column(name = "bull_no", nullable = false, unique = true)
    private String bullNo;

    @Column(name = "bull_name")
    private String bullName;

    @Column(name = "inaph_id")
    private String inaphId;

    /** CATTLE or BUFFALO. */
    private String category;

    /** Station breed label: HF, Jersey, HFxSahiwal, HFCB, ... */
    private String breed;

    /** Station rating: Premium, Imported, 5*, 1*, ... */
    @Column(name = "star_value")
    private String starValue;

    @Column(name = "date_of_birth")
    private String dateOfBirth;

    @Column(name = "dam_no")
    private String damNo;

    @Column(name = "dam_name")
    private String damName;

    @Column(name = "dam_best_yield_kg")
    private Double damBestYieldKg;

    @Column(name = "dam_fat_pct")
    private Double damFatPct;

    @Column(name = "sire_no")
    private String sireNo;

    @Column(name = "sire_name")
    private String sireName;

    @Column(name = "sire_dam_best_yield_kg")
    private Double sireDamBestYieldKg;

    /** Average yield of this bull's sire's daughters, kg, when the station publishes it. */
    @Column(name = "sire_daughters_yield_kg")
    private Double sireDaughtersYieldKg;

    @Column(name = "breeding_value")
    private Double breedingValue;

    @Column(name = "image_url", length = 500)
    private String imageUrl;

    @Column(name = "source_url", length = 500)
    private String sourceUrl;

    private String station;

    @Column(length = 1000)
    private String notes;

    public SireBull() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getBullNo() { return bullNo; }
    public void setBullNo(String bullNo) { this.bullNo = bullNo; }
    public String getBullName() { return bullName; }
    public void setBullName(String bullName) { this.bullName = bullName; }
    public String getInaphId() { return inaphId; }
    public void setInaphId(String inaphId) { this.inaphId = inaphId; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public String getBreed() { return breed; }
    public void setBreed(String breed) { this.breed = breed; }
    public String getStarValue() { return starValue; }
    public void setStarValue(String starValue) { this.starValue = starValue; }
    public String getDateOfBirth() { return dateOfBirth; }
    public void setDateOfBirth(String dateOfBirth) { this.dateOfBirth = dateOfBirth; }
    public String getDamNo() { return damNo; }
    public void setDamNo(String damNo) { this.damNo = damNo; }
    public String getDamName() { return damName; }
    public void setDamName(String damName) { this.damName = damName; }
    public Double getDamBestYieldKg() { return damBestYieldKg; }
    public void setDamBestYieldKg(Double damBestYieldKg) { this.damBestYieldKg = damBestYieldKg; }
    public Double getDamFatPct() { return damFatPct; }
    public void setDamFatPct(Double damFatPct) { this.damFatPct = damFatPct; }
    public String getSireNo() { return sireNo; }
    public void setSireNo(String sireNo) { this.sireNo = sireNo; }
    public String getSireName() { return sireName; }
    public void setSireName(String sireName) { this.sireName = sireName; }
    public Double getSireDamBestYieldKg() { return sireDamBestYieldKg; }
    public void setSireDamBestYieldKg(Double v) { this.sireDamBestYieldKg = v; }
    public Double getSireDaughtersYieldKg() { return sireDaughtersYieldKg; }
    public void setSireDaughtersYieldKg(Double v) { this.sireDaughtersYieldKg = v; }
    public Double getBreedingValue() { return breedingValue; }
    public void setBreedingValue(Double breedingValue) { this.breedingValue = breedingValue; }
    public String getImageUrl() { return imageUrl; }
    public void setImageUrl(String imageUrl) { this.imageUrl = imageUrl; }
    public String getSourceUrl() { return sourceUrl; }
    public void setSourceUrl(String sourceUrl) { this.sourceUrl = sourceUrl; }
    public String getStation() { return station; }
    public void setStation(String station) { this.station = station; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
}
