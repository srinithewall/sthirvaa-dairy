package com.dairy.model;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "milk_records")
public class MilkRecord {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "herd_id", nullable = false)
    private Herd herd;

    @Column(nullable = false)
    private Double quantity;

    @Column(nullable = false)
    private LocalDate date;

    @Column(nullable = false)
    private String shift;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "worker_id")
    private User worker;

    private LocalDateTime createdAt;

    public MilkRecord() {}

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Herd getHerd() { return herd; }
    public void setHerd(Herd herd) { 
        this.herd = herd; 
        if (herd != null) {
            this.herdId = herd.getId();
        }
    }

    public Long getHerdId() { return herdId; }
    public void setHerdId(Long herdId) { this.herdId = herdId; }

    public Double getQuantity() { return quantity; }
    public void setQuantity(Double quantity) { this.quantity = quantity; }

    public LocalDate getDate() { return date; }
    public void setDate(LocalDate date) { this.date = date; }

    public String getShift() { return shift; }
    public void setShift(String shift) { this.shift = shift; }

    public User getWorker() { return worker; }
    public void setWorker(User worker) { this.worker = worker; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
