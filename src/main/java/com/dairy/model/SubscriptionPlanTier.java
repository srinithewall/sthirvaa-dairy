package com.dairy.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;

@Entity
@Table(name = "subscription_plan_tiers",
       uniqueConstraints = @UniqueConstraint(columnNames = {"plan_id", "duration_months"}))
public class SubscriptionPlanTier {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "plan_id", nullable = false)
    @JsonIgnoreProperties({"items", "tiers", "hibernateLazyInitializer", "handler"})
    private SubscriptionPlan plan;

    /** Number of months for this tier, e.g. 1, 2, 3, 6, 12 */
    @Column(name = "duration_months", nullable = false)
    private Integer durationMonths;

    /** Human-readable label, e.g. "1 Month", "3 Months" */
    @Column(name = "label", nullable = false)
    private String label;

    /** Discount percentage for this tier, e.g. 0.0, 5.0, 7.0 */
    @Column(name = "discount_percent", nullable = false)
    private Double discountPercent = 0.0;

    public SubscriptionPlanTier() {}

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public SubscriptionPlan getPlan() { return plan; }
    public void setPlan(SubscriptionPlan plan) { this.plan = plan; }

    public Integer getDurationMonths() { return durationMonths; }
    public void setDurationMonths(Integer durationMonths) { this.durationMonths = durationMonths; }

    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }

    public Double getDiscountPercent() { return discountPercent; }
    public void setDiscountPercent(Double discountPercent) { this.discountPercent = discountPercent; }
}
