package com.dairy.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "customers")
public class Customer {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String phone;
    
    private String address;

    @Column(name = "default_rate", columnDefinition = "DOUBLE DEFAULT 45.0")
    private Double defaultRate = 45.0;

    private LocalDateTime createdAt;

    /** Where the milk is delivered, e.g. "Avalahali". */
    @Column(name = "delivery_location")
    private String deliveryLocation;

    /** Round-trip distance for one delivery, in km. */
    @Column(name = "delivery_km")
    private Double deliveryKm;

    public Customer() {}

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }

    public Double getDefaultRate() { return defaultRate; }
    public void setDefaultRate(Double defaultRate) { this.defaultRate = defaultRate; }

    public String getDeliveryLocation() { return deliveryLocation; }
    public void setDeliveryLocation(String deliveryLocation) { this.deliveryLocation = deliveryLocation; }

    public Double getDeliveryKm() { return deliveryKm; }
    public void setDeliveryKm(Double deliveryKm) { this.deliveryKm = deliveryKm; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
