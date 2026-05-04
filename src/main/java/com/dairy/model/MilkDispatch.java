package com.dairy.model;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "milk_dispatches")
public class MilkDispatch {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private LocalDate date;

    @Column(nullable = false)
    private String shift; // MORNING / EVENING / COMBINED

    // Customer who received the milk (nullable for waste/own-use rows)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id")
    @com.fasterxml.jackson.annotation.JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Customer customer;

    // "CUSTOMER", "WASTE", "OWN_USE"
    @Column(name = "dispatch_type", nullable = false)
    private String dispatchType = "CUSTOMER";

    @Column(nullable = false)
    private Double quantity; // Litres

    @Column(nullable = false)
    private Double ratePerLitre; // ₹ per litre at time of dispatch

    @Column(nullable = false)
    private Double totalAmount; // quantity * ratePerLitre

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public MilkDispatch() {}

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (totalAmount == null && quantity != null && ratePerLitre != null) {
            totalAmount = quantity * ratePerLitre;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public LocalDate getDate() { return date; }
    public void setDate(LocalDate date) { this.date = date; }

    public String getShift() { return shift; }
    public void setShift(String shift) { this.shift = shift; }

    public Customer getCustomer() { return customer; }
    public void setCustomer(Customer customer) { this.customer = customer; }

    public String getDispatchType() { return dispatchType; }
    public void setDispatchType(String dispatchType) { this.dispatchType = dispatchType; }

    public Double getQuantity() { return quantity; }
    public void setQuantity(Double quantity) { this.quantity = quantity; }

    public Double getRatePerLitre() { return ratePerLitre; }
    public void setRatePerLitre(Double ratePerLitre) { this.ratePerLitre = ratePerLitre; }

    public Double getTotalAmount() { return totalAmount; }
    public void setTotalAmount(Double totalAmount) { this.totalAmount = totalAmount; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
