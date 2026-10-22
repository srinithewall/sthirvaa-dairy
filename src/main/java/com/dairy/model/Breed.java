package com.dairy.model;

import jakarta.persistence.*;

@Entity
@Table(name = "breed_masters")
public class Breed {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String name;

    private String description;

    // Weight Calculation Meta
    @Column(name = "length_ratio")
    private Double lengthRatio; // e.g., 1.05

    @Column(name = "formula_type")
    private String formulaType; // "SCHAEFFER", "AGARWAL"

    // Weight Classification Thresholds (in kg)
    @Column(name = "very_low_max")
    private Double veryLowMax;

    @Column(name = "low_max")
    private Double lowMax;

    @Column(name = "below_avg_max")
    private Double belowAvgMax;

    @Column(name = "avg_max")
    private Double avgMax;

    @Column(name = "slightly_overweight_max")
    private Double slightlyOverweightMax;

    // No max for Overweight, anything above slightlyOverweightMax is Overweight

    /** Typical market price of a healthy adult in its 2nd-3rd lactation, in rupees. */
    @Column(name = "base_price")
    private Double basePrice;

    /** Normal daily milk yield for the breed, litres. */
    @Column(name = "normal_yield")
    private Double normalYield;

    public Double getBasePrice() { return basePrice; }
    public void setBasePrice(Double basePrice) { this.basePrice = basePrice; }
    public Double getNormalYield() { return normalYield; }
    public void setNormalYield(Double normalYield) { this.normalYield = normalYield; }

    public Breed() {}

    public Breed(String name, String description, Double lengthRatio, String formulaType,
                 Double veryLowMax, Double lowMax, Double belowAvgMax, Double avgMax, Double slightlyOverweightMax) {
        this.name = name;
        this.description = description;
        this.lengthRatio = lengthRatio;
        this.formulaType = formulaType;
        this.veryLowMax = veryLowMax;
        this.lowMax = lowMax;
        this.belowAvgMax = belowAvgMax;
        this.avgMax = avgMax;
        this.slightlyOverweightMax = slightlyOverweightMax;
    }

    // Getters and setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public Double getLengthRatio() { return lengthRatio; }
    public void setLengthRatio(Double lengthRatio) { this.lengthRatio = lengthRatio; }

    public String getFormulaType() { return formulaType; }
    public void setFormulaType(String formulaType) { this.formulaType = formulaType; }

    public Double getVeryLowMax() { return veryLowMax; }
    public void setVeryLowMax(Double veryLowMax) { this.veryLowMax = veryLowMax; }

    public Double getLowMax() { return lowMax; }
    public void setLowMax(Double lowMax) { this.lowMax = lowMax; }

    public Double getBelowAvgMax() { return belowAvgMax; }
    public void setBelowAvgMax(Double belowAvgMax) { this.belowAvgMax = belowAvgMax; }

    public Double getAvgMax() { return avgMax; }
    public void setAvgMax(Double avgMax) { this.avgMax = avgMax; }

    public Double getSlightlyOverweightMax() { return slightlyOverweightMax; }
    public void setSlightlyOverweightMax(Double slightlyOverweightMax) { this.slightlyOverweightMax = slightlyOverweightMax; }
}
