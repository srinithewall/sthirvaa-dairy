package com.dairy.model;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

@Entity
@Table(name = "farm_activity_logs")
public class FarmActivityLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "activity_id", nullable = false)
    private Long activityId;

    @Column(name = "due_date", nullable = false)
    private LocalDate dueDate;

    @Column(name = "due_time")
    private LocalTime dueTime;

    @Column(name = "completed_date")
    private LocalDate completedDate;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Enumerated(EnumType.STRING)
    private ActivityStatus status = ActivityStatus.PENDING;

    @Column(name = "assigned_staff_id")
    private Long assignedStaffId;

    @Column(name = "completed_by_staff_id")
    private Long completedByStaffId;

    @Column(name = "last_reminder_at")
    private LocalDateTime lastReminderAt;

    @Column(name = "reminder_count")
    private Integer reminderCount = 0;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Transient
    private FarmActivity activityDetails;

    @Transient
    private Staff staffDetails;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getActivityId() { return activityId; }
    public void setActivityId(Long activityId) { this.activityId = activityId; }

    public LocalDate getDueDate() { return dueDate; }
    public void setDueDate(LocalDate dueDate) { this.dueDate = dueDate; }

    public LocalTime getDueTime() { return dueTime; }
    public void setDueTime(LocalTime dueTime) { this.dueTime = dueTime; }

    public LocalDate getCompletedDate() { return completedDate; }
    public void setCompletedDate(LocalDate completedDate) { this.completedDate = completedDate; }

    public LocalDateTime getCompletedAt() { return completedAt; }
    public void setCompletedAt(LocalDateTime completedAt) { this.completedAt = completedAt; }

    public ActivityStatus getStatus() { return status; }
    public void setStatus(ActivityStatus status) { this.status = status; }

    public Long getAssignedStaffId() { return assignedStaffId; }
    public void setAssignedStaffId(Long assignedStaffId) { this.assignedStaffId = assignedStaffId; }

    public Long getCompletedByStaffId() { return completedByStaffId; }
    public void setCompletedByStaffId(Long completedByStaffId) { this.completedByStaffId = completedByStaffId; }

    public LocalDateTime getLastReminderAt() { return lastReminderAt; }
    public void setLastReminderAt(LocalDateTime lastReminderAt) { this.lastReminderAt = lastReminderAt; }

    public Integer getReminderCount() { return reminderCount; }
    public void setReminderCount(Integer reminderCount) { this.reminderCount = reminderCount; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public FarmActivity getActivityDetails() { return activityDetails; }
    public void setActivityDetails(FarmActivity activityDetails) { this.activityDetails = activityDetails; }

    public Staff getStaffDetails() { return staffDetails; }
    public void setStaffDetails(Staff staffDetails) { this.staffDetails = staffDetails; }
}
