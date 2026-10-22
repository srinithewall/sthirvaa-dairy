package com.dairy.model;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "assets")
public class Asset {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    private String category;

    @Column(name = "purchase_date")
    private LocalDate purchaseDate;

    private Double value;

    @Column(name = "market_value")
    private Double marketValue;

    private String status; // e.g., ACTIVE, MAINTENANCE, DISPOSED

    @Column(name = "serial_number")
    private String serialNumber;

    /** True when the owner set marketValue by hand; otherwise the suggested value applies. */
    @Column(name = "market_value_manual")
    private Boolean marketValueManual;

    @Column(name = "market_value_note", length = 300)
    private String marketValueNote;

    // Computed on read by AssetValuationService; never stored.
    @Transient
    private Double suggestedValue;
    @Transient
    private Double suggestedLow;
    @Transient
    private Double suggestedHigh;
    /** ANIMAL, EQUIPMENT or NONE (no rule for this category). */
    @Transient
    private String valuationBasis;
    @Transient
    private java.util.List<String> valuationFactors;

    public Boolean getMarketValueManual() { return marketValueManual; }
    public void setMarketValueManual(Boolean marketValueManual) { this.marketValueManual = marketValueManual; }
    public String getMarketValueNote() { return marketValueNote; }
    public void setMarketValueNote(String marketValueNote) { this.marketValueNote = marketValueNote; }
    public Double getSuggestedValue() { return suggestedValue; }
    public void setSuggestedValue(Double suggestedValue) { this.suggestedValue = suggestedValue; }
    public Double getSuggestedLow() { return suggestedLow; }
    public void setSuggestedLow(Double suggestedLow) { this.suggestedLow = suggestedLow; }
    public Double getSuggestedHigh() { return suggestedHigh; }
    public void setSuggestedHigh(Double suggestedHigh) { this.suggestedHigh = suggestedHigh; }
    public String getValuationBasis() { return valuationBasis; }
    public void setValuationBasis(String valuationBasis) { this.valuationBasis = valuationBasis; }
    public java.util.List<String> getValuationFactors() { return valuationFactors; }
    public void setValuationFactors(java.util.List<String> valuationFactors) { this.valuationFactors = valuationFactors; }

    /** The value to show and total: the manual value when set, else the suggestion, else what was entered. */
    @com.fasterxml.jackson.annotation.JsonProperty(access = com.fasterxml.jackson.annotation.JsonProperty.Access.READ_ONLY)
    public Double getEffectiveMarketValue() {
        if (Boolean.TRUE.equals(marketValueManual) && marketValue != null) return marketValue;
        if (suggestedValue != null) return suggestedValue;
        return marketValue != null ? marketValue : value;
    }

    private String location;

    @Column(name = "created_at")
    private LocalDateTime createdAt;
    
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public Asset() {}

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

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public LocalDate getPurchaseDate() { return purchaseDate; }
    public void setPurchaseDate(LocalDate purchaseDate) { this.purchaseDate = purchaseDate; }

    public Double getValue() { return value; }
    public void setValue(Double value) { this.value = value; }

    public Double getMarketValue() { return marketValue; }
    public void setMarketValue(Double marketValue) { this.marketValue = marketValue; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getSerialNumber() { return serialNumber; }
    public void setSerialNumber(String serialNumber) { this.serialNumber = serialNumber; }

    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
