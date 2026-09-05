package com.dairy.model;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "herd_weight_records")
public class HerdWeightRecord {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "herd_id", nullable = false)
    private Long herdId;

    @Column(name = "record_date", nullable = false)
    private LocalDate recordDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "measurement_method", nullable = false)
    private MeasurementMethod measurementMethod = MeasurementMethod.HEART_GIRTH_TAPE;

    @Column(name = "heart_girth_cm", nullable = false)
    private Double heartGirthCm;

    @Column(name = "body_length_cm")
    private Double bodyLengthCm;

    @Column(name = "weight_kg", nullable = false)
    private Double weightKg;

    @Column(name = "weight_change_kg")
    private Double weightChangeKg;

    @Column(name = "body_condition_score")
    private Double bodyConditionScore;

    @Column(name = "recorded_by")
    private Long recordedBy;

    @Column(length = 500)
    private String notes;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Transient
    private Staff staffDetails;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getHerdId() { return herdId; }
    public void setHerdId(Long herdId) { this.herdId = herdId; }

    public LocalDate getRecordDate() { return recordDate; }
    public void setRecordDate(LocalDate recordDate) { this.recordDate = recordDate; }

    public MeasurementMethod getMeasurementMethod() { return measurementMethod; }
    public void setMeasurementMethod(MeasurementMethod measurementMethod) { this.measurementMethod = measurementMethod; }

    public Double getHeartGirthCm() { return heartGirthCm; }
    public void setHeartGirthCm(Double heartGirthCm) { this.heartGirthCm = heartGirthCm; }

    public Double getBodyLengthCm() { return bodyLengthCm; }
    public void setBodyLengthCm(Double bodyLengthCm) { this.bodyLengthCm = bodyLengthCm; }

    public Double getWeightKg() { return weightKg; }
    public void setWeightKg(Double weightKg) { this.weightKg = weightKg; }

    public Double getWeightChangeKg() { return weightChangeKg; }
    public void setWeightChangeKg(Double weightChangeKg) { this.weightChangeKg = weightChangeKg; }

    public Double getBodyConditionScore() { return bodyConditionScore; }
    public void setBodyConditionScore(Double bodyConditionScore) { this.bodyConditionScore = bodyConditionScore; }

    public Long getRecordedBy() { return recordedBy; }
    public void setRecordedBy(Long recordedBy) { this.recordedBy = recordedBy; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public Staff getStaffDetails() { return staffDetails; }
    public void setStaffDetails(Staff staffDetails) { this.staffDetails = staffDetails; }
}
