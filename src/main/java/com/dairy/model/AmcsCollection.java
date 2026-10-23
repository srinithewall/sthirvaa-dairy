package com.dairy.model;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * One milk pour recorded by the dairy society's AMCS (Automatic Milk Collection System) for our
 * member account, as reported by AMCS itself. This is the society-side record of what KMF paid
 * for; the matching MilkDispatch row (one per date+shift) is derived from it.
 */
@Entity
@Table(
    name = "amcs_collections",
    uniqueConstraints = @UniqueConstraint(
        name = "uk_amcs_member_date_shift_sample",
        columnNames = {"member_code", "collection_date", "shift", "sample_no"}))
public class AmcsCollection {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "member_code", nullable = false, length = 32)
    private String memberCode;

    @Column(name = "collection_date", nullable = false)
    private LocalDate date;

    // MORNING / EVENING, same vocabulary as MilkRecord and MilkDispatch
    @Column(nullable = false, length = 16)
    private String shift;

    @Column(name = "sample_no", nullable = false)
    private Integer sampleNo;

    @Column(name = "animal_type", length = 32)
    private String animalType;

    @Column(nullable = false)
    private Double quantity; // Litres

    private Double fat;
    private Double snf;
    private Double clr;

    @Column(name = "rate_per_litre")
    private Double ratePerLitre;

    @Column(name = "amount", nullable = false)
    private Double amount;

    // Manually keyed values in AMCS (quality or quantity not read from the analyser)
    @Column(name = "quality_manual")
    private Boolean qualityManual;

    @Column(name = "quantity_manual")
    private Boolean quantityManual;

    // Set by AMCS when someone other than the collection machine edited the row (e.g. the
    // society supervisor). Both stay null for untouched rows.
    @Column(name = "amcs_updated_by", length = 64)
    private String amcsUpdatedBy;

    @Column(name = "amcs_updated_at")
    private LocalDateTime amcsUpdatedAt;

    @Column(name = "imported_at")
    private LocalDateTime importedAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public AmcsCollection() {}

    @PrePersist
    protected void onCreate() {
        importedAt = LocalDateTime.now();
        updatedAt = importedAt;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getMemberCode() { return memberCode; }
    public void setMemberCode(String memberCode) { this.memberCode = memberCode; }

    public LocalDate getDate() { return date; }
    public void setDate(LocalDate date) { this.date = date; }

    public String getShift() { return shift; }
    public void setShift(String shift) { this.shift = shift; }

    public Integer getSampleNo() { return sampleNo; }
    public void setSampleNo(Integer sampleNo) { this.sampleNo = sampleNo; }

    public String getAnimalType() { return animalType; }
    public void setAnimalType(String animalType) { this.animalType = animalType; }

    public Double getQuantity() { return quantity; }
    public void setQuantity(Double quantity) { this.quantity = quantity; }

    public Double getFat() { return fat; }
    public void setFat(Double fat) { this.fat = fat; }

    public Double getSnf() { return snf; }
    public void setSnf(Double snf) { this.snf = snf; }

    public Double getClr() { return clr; }
    public void setClr(Double clr) { this.clr = clr; }

    public Double getRatePerLitre() { return ratePerLitre; }
    public void setRatePerLitre(Double ratePerLitre) { this.ratePerLitre = ratePerLitre; }

    public Double getAmount() { return amount; }
    public void setAmount(Double amount) { this.amount = amount; }

    public Boolean getQualityManual() { return qualityManual; }
    public void setQualityManual(Boolean qualityManual) { this.qualityManual = qualityManual; }

    public Boolean getQuantityManual() { return quantityManual; }
    public void setQuantityManual(Boolean quantityManual) { this.quantityManual = quantityManual; }

    public String getAmcsUpdatedBy() { return amcsUpdatedBy; }
    public void setAmcsUpdatedBy(String amcsUpdatedBy) { this.amcsUpdatedBy = amcsUpdatedBy; }

    public LocalDateTime getAmcsUpdatedAt() { return amcsUpdatedAt; }
    public void setAmcsUpdatedAt(LocalDateTime amcsUpdatedAt) { this.amcsUpdatedAt = amcsUpdatedAt; }

    public LocalDateTime getImportedAt() { return importedAt; }
    public void setImportedAt(LocalDateTime importedAt) { this.importedAt = importedAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
