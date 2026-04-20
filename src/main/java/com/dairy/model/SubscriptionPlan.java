package com.dairy.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "subscription_plans")
public class SubscriptionPlan {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(unique = true)
    private String slug; // URL-safe identifier e.g. "essential-dairy"

    private String tagline;

    @Column(name = "monthly_price", nullable = false)
    private Double monthlyPrice;

    @Column(name = "quarterly_price")
    private Double quarterlyPrice;

    @Column(name = "half_yearly_price")
    private Double halfYearlyPrice;

    @Column(name = "yearly_price")
    private Double yearlyPrice;

    @Column(name = "badge_text")
    private String badgeText; // e.g. "Most Popular", "Best Value"

    @Column(name = "image_url")
    private String imageUrl;

    @Column(name = "display_order")
    private Integer displayOrder = 0;

    @Column(name = "is_active")
    private Boolean isActive = true;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    // --- Legacy columns kept for safe migration (Hibernate ddl-auto=update won't drop them) ---
    @Column(name = "price_per_month", insertable = false, updatable = false)
    private Double pricePerMonth; // mapped to monthly_price going forward

    @Column(name = "sort_order", insertable = false, updatable = false)
    private Integer sortOrder; // superseded by display_order

    @OneToMany(mappedBy = "plan", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnoreProperties("plan")
    private List<SubscriptionPlanItem> items = new ArrayList<>();

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
        if (this.slug == null && this.name != null) {
            this.slug = this.name.toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("^-|-$", "");
        }
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public SubscriptionPlan() {}

    public void addItem(SubscriptionPlanItem item) {
        items.add(item);
        item.setPlan(this);
    }

    public void removeItem(SubscriptionPlanItem item) {
        items.remove(item);
        item.setPlan(null);
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getSlug() { return slug; }
    public void setSlug(String slug) { this.slug = slug; }

    public String getTagline() { return tagline; }
    public void setTagline(String tagline) { this.tagline = tagline; }

    public Double getMonthlyPrice() { return monthlyPrice; }
    public void setMonthlyPrice(Double monthlyPrice) { this.monthlyPrice = monthlyPrice; }

    public Double getQuarterlyPrice() { return quarterlyPrice; }
    public void setQuarterlyPrice(Double quarterlyPrice) { this.quarterlyPrice = quarterlyPrice; }

    public Double getHalfYearlyPrice() { return halfYearlyPrice; }
    public void setHalfYearlyPrice(Double halfYearlyPrice) { this.halfYearlyPrice = halfYearlyPrice; }

    public Double getYearlyPrice() { return yearlyPrice; }
    public void setYearlyPrice(Double yearlyPrice) { this.yearlyPrice = yearlyPrice; }

    public String getBadgeText() { return badgeText; }
    public void setBadgeText(String badgeText) { this.badgeText = badgeText; }

    public String getImageUrl() { return imageUrl; }
    public void setImageUrl(String imageUrl) { this.imageUrl = imageUrl; }

    public Integer getDisplayOrder() { return displayOrder; }
    public void setDisplayOrder(Integer displayOrder) { this.displayOrder = displayOrder; }

    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean isActive) { this.isActive = isActive; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public List<SubscriptionPlanItem> getItems() { return items; }
    public void setItems(List<SubscriptionPlanItem> items) {
        this.items.clear();
        if (items != null) {
            items.forEach(this::addItem);
        }
    }
}
