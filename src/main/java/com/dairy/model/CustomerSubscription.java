package com.dairy.model;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "customer_subscriptions")
public class CustomerSubscription {

    public enum Status { ACTIVE, PAUSED, CANCELLED, EXPIRED }

    public enum BillingCycle { MONTHLY, QUARTERLY, HALF_YEARLY, YEARLY }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** FK → customers.id */
    @Column(name = "customer_id", nullable = false)
    private Long customerId;

    /** FK → subscription_plans.id */
    @Column(name = "plan_id", nullable = false)
    private Long planId;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "next_renewal")
    private LocalDate nextRenewal;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status = Status.ACTIVE;

    @Column(name = "delivery_address", columnDefinition = "TEXT")
    private String deliveryAddress;

    @Enumerated(EnumType.STRING)
    @Column(name = "billing_cycle", nullable = false)
    private BillingCycle billingCycle = BillingCycle.MONTHLY;

    /** Pause window — deliveries are skipped in this range */
    @Column(name = "pause_from")
    private LocalDate pauseFrom;

    @Column(name = "pause_to")
    private LocalDate pauseTo;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
        if (this.startDate == null) this.startDate = LocalDate.now();
        if (this.nextRenewal == null) this.nextRenewal = computeNextRenewal(this.startDate, this.billingCycle);
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    private LocalDate computeNextRenewal(LocalDate from, BillingCycle cycle) {
        if (from == null || cycle == null) return null;
        return switch (cycle) {
            case MONTHLY -> from.plusMonths(1);
            case QUARTERLY -> from.plusMonths(3);
            case HALF_YEARLY -> from.plusMonths(6);
            case YEARLY -> from.plusYears(1);
        };
    }

    public CustomerSubscription() {}

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getCustomerId() { return customerId; }
    public void setCustomerId(Long customerId) { this.customerId = customerId; }

    public Long getPlanId() { return planId; }
    public void setPlanId(Long planId) { this.planId = planId; }

    public LocalDate getStartDate() { return startDate; }
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }

    public LocalDate getNextRenewal() { return nextRenewal; }
    public void setNextRenewal(LocalDate nextRenewal) { this.nextRenewal = nextRenewal; }

    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }

    public String getDeliveryAddress() { return deliveryAddress; }
    public void setDeliveryAddress(String deliveryAddress) { this.deliveryAddress = deliveryAddress; }

    public BillingCycle getBillingCycle() { return billingCycle; }
    public void setBillingCycle(BillingCycle billingCycle) { this.billingCycle = billingCycle; }

    public LocalDate getPauseFrom() { return pauseFrom; }
    public void setPauseFrom(LocalDate pauseFrom) { this.pauseFrom = pauseFrom; }

    public LocalDate getPauseTo() { return pauseTo; }
    public void setPauseTo(LocalDate pauseTo) { this.pauseTo = pauseTo; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
