package com.dairy.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "subscription_plan_items")
public class SubscriptionPlanItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "plan_id", nullable = false)
    @JsonIgnoreProperties("items")
    private SubscriptionPlan plan;

    /**
     * FK to the products table.
     * Nullable to allow free-text / custom items (e.g. "Divine Pooja Pack")
     * that don't have a product catalogue entry.
     */
    @Column(name = "product_id")
    private Long productId;

    /**
     * Human-readable description used when product_id is null
     * OR as an override display name.
     * e.g. "Sthirvaa A2 Gir Milk", "Includes Divine Pooja Pack"
     */
    @Column(nullable = false)
    private String description;

    @Column(nullable = false)
    private Double qty; // e.g. 1.0, 0.5, 30.0

    @Column(nullable = false)
    private String unit; // "litre", "kg", "g", "pcs", "ml"

    /**
     * Delivery frequency of this item within the plan.
     * DAILY | WEEKLY | MONTHLY | ONE_TIME
     */
    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private DeliveryFrequency frequency = DeliveryFrequency.MONTHLY;

    /** Market Retail Price (what it would cost if bought separately) */
    @Column(name = "mrp")
    private Double mrp;

    /** Price charged to the subscriber for this item */
    @Column(name = "selling_price")
    private Double sellingPrice;

    @Column(name = "is_free")
    private boolean isFree = false;

    @Column(name = "display_order")
    private Integer displayOrder = 0;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    public enum DeliveryFrequency {
        DAILY, WEEKLY, MONTHLY, ONE_TIME
    }

    public SubscriptionPlanItem() {}

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public SubscriptionPlan getPlan() { return plan; }
    public void setPlan(SubscriptionPlan plan) { this.plan = plan; }

    public Long getProductId() { return productId; }
    public void setProductId(Long productId) { this.productId = productId; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public Double getQty() { return qty; }
    public void setQty(Double qty) { this.qty = qty; }

    public String getUnit() { return unit; }
    public void setUnit(String unit) { this.unit = unit; }

    public DeliveryFrequency getFrequency() { return frequency; }
    public void setFrequency(DeliveryFrequency frequency) { this.frequency = frequency; }

    public Double getMrp() { return mrp; }
    public void setMrp(Double mrp) { this.mrp = mrp; }

    public Double getSellingPrice() { return sellingPrice; }
    public void setSellingPrice(Double sellingPrice) { this.sellingPrice = sellingPrice; }

    public boolean isFree() { return isFree; }
    public void setFree(boolean isFree) { this.isFree = isFree; }

    public Integer getDisplayOrder() { return displayOrder; }
    public void setDisplayOrder(Integer displayOrder) { this.displayOrder = displayOrder; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
