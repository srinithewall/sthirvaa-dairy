package com.dairy.model;

import jakarta.persistence.*;

@Entity
@Table(name = "semen_catalog")
public class SemenCatalog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "semen_id", unique = true, nullable = false)
    private String semenId;          // e.g. "hf-elite"

    @Column(name = "bull_id")
    private String bullId;           // e.g. "HF-2204"

    @Column(name = "breed_name")
    private String breedName;

    @Column(name = "breed_code")
    private String breedCode;

    @Column(name = "abs_score")
    private String absScore;         // e.g. "ABS 7"

    @Column(name = "color_hex")
    private String colorHex;         // e.g. "#3B82F6"

    @Column(name = "color_label")
    private String colorLabel;

    @Column(name = "semen_code")
    private String semenCode;

    @Column(name = "milk_potential")
    private String milkPotential;

    @Column(name = "fat")
    private String fat;

    @Column(name = "benefits", columnDefinition = "TEXT")
    private String benefits;         // CSV: "Heat Tolerant,High Milk,..."

    @Column(name = "success_rate")
    private Integer successRate;

    @Column(name = "pregnancy_rate")
    private Integer pregnancyRate;

    @Column(name = "female_calf_pct")
    private Integer femaleCalfPct;

    private Integer price;

    @Column(name = "technician_count")
    private Integer technicianCount;

    @Column(name = "fastest_arrival")
    private String fastestArrival;

    @Column(name = "slots", columnDefinition = "TEXT")
    private String slots;            // CSV: "7:00 AM – 9:00 AM,5:00 PM – 7:00 PM"

    @Column(name = "animal_type")
    private String animalType;       // COW | BUFFALO | ANY

    @Column(name = "best_for", columnDefinition = "TEXT")
    private String bestFor;          // CSV: "hf,holstein,cross"

    @Column(name = "straw_image")
    private String strawImage;       // URL path e.g. "/semen/straw-blue.png"

    @Column(name = "calf_image")
    private String calfImage;        // URL path e.g. "/semen/calf-holstein.png"

    @Column(nullable = false)
    private String status = "ACTIVE";

    public SemenCatalog() {}

    // ─── Getters & Setters ──────────────────────────────────────────────────

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getSemenId() { return semenId; }
    public void setSemenId(String semenId) { this.semenId = semenId; }

    public String getBullId() { return bullId; }
    public void setBullId(String bullId) { this.bullId = bullId; }

    public String getBreedName() { return breedName; }
    public void setBreedName(String breedName) { this.breedName = breedName; }

    public String getBreedCode() { return breedCode; }
    public void setBreedCode(String breedCode) { this.breedCode = breedCode; }

    public String getAbsScore() { return absScore; }
    public void setAbsScore(String absScore) { this.absScore = absScore; }

    public String getColorHex() { return colorHex; }
    public void setColorHex(String colorHex) { this.colorHex = colorHex; }

    public String getColorLabel() { return colorLabel; }
    public void setColorLabel(String colorLabel) { this.colorLabel = colorLabel; }

    public String getSemenCode() { return semenCode; }
    public void setSemenCode(String semenCode) { this.semenCode = semenCode; }

    public String getMilkPotential() { return milkPotential; }
    public void setMilkPotential(String milkPotential) { this.milkPotential = milkPotential; }

    public String getFat() { return fat; }
    public void setFat(String fat) { this.fat = fat; }

    public String getBenefits() { return benefits; }
    public void setBenefits(String benefits) { this.benefits = benefits; }

    public Integer getSuccessRate() { return successRate; }
    public void setSuccessRate(Integer successRate) { this.successRate = successRate; }

    public Integer getPregnancyRate() { return pregnancyRate; }
    public void setPregnancyRate(Integer pregnancyRate) { this.pregnancyRate = pregnancyRate; }

    public Integer getFemaleCalfPct() { return femaleCalfPct; }
    public void setFemaleCalfPct(Integer femaleCalfPct) { this.femaleCalfPct = femaleCalfPct; }

    public Integer getPrice() { return price; }
    public void setPrice(Integer price) { this.price = price; }

    public Integer getTechnicianCount() { return technicianCount; }
    public void setTechnicianCount(Integer technicianCount) { this.technicianCount = technicianCount; }

    public String getFastestArrival() { return fastestArrival; }
    public void setFastestArrival(String fastestArrival) { this.fastestArrival = fastestArrival; }

    public String getSlots() { return slots; }
    public void setSlots(String slots) { this.slots = slots; }

    public String getAnimalType() { return animalType; }
    public void setAnimalType(String animalType) { this.animalType = animalType; }

    public String getBestFor() { return bestFor; }
    public void setBestFor(String bestFor) { this.bestFor = bestFor; }

    public String getStrawImage() { return strawImage; }
    public void setStrawImage(String strawImage) { this.strawImage = strawImage; }

    public String getCalfImage() { return calfImage; }
    public void setCalfImage(String calfImage) { this.calfImage = calfImage; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
}
