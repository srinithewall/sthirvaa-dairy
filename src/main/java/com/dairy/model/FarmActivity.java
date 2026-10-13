package com.dairy.model;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

@Entity
@Table(name = "farm_activities")
public class FarmActivity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ActivityCategory category = ActivityCategory.HYGIENE;

    // varchar, not a DB enum: ddl-auto=update never alters an existing column type, so a new
    // frequency added here would be rejected at insert time by an enum column that predates it.
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "varchar(20)")
    private ActivityFrequency frequency;

    // CUSTOM_DAYS: repeat every N days counting from anchorDate
    @Column(name = "interval_days")
    private Integer intervalDays = 1;

    // WEEKLY: comma separated java.time.DayOfWeek names, e.g. "MONDAY,THURSDAY"
    @Column(name = "day_of_week")
    private String dayOfWeek;

    // BI_WEEKLY / MONTHLY: comma separated days of month, e.g. "1,15,30".
    // A day beyond the length of the month falls back to the last day of that month.
    @Column(name = "days_of_month")
    private String daysOfMonth;

    // ONCE: the single due date. CUSTOM_DAYS: the date the interval counts from.
    @Column(name = "anchor_date")
    private LocalDate anchorDate;

    // Time of day the chore is due; reminders only start once this time has passed.
    @Column(name = "due_time")
    private LocalTime dueTime;

    @Column(name = "default_assigned_staff_id")
    private Long defaultAssignedStaffId;

    // Non-null marks a routine seeded and owned by the system (cannot be deleted,
    // and its wiring - category, action route - is not editable).
    @Column(name = "system_key", unique = true)
    private String systemKey;

    // In-app route opened when the reminder notification is tapped.
    @Column(name = "action_route")
    private String actionRoute;

    // Links related activities together (e.g. planting -> fertilizing -> harvest)
    @Column(name = "chain_id")
    private String chainId;

    @Column(name = "reminder_enabled")
    private Boolean reminderEnabled = false;

    @Column(name = "reminder_interval_hours")
    private Integer reminderIntervalHours = 2;

    @Column(name = "reminder_start_time")
    private LocalTime reminderStartTime = LocalTime.of(6, 0);

    @Column(name = "reminder_end_time")
    private LocalTime reminderEndTime = LocalTime.of(20, 0);

    @Column(name = "reminder_max_per_day")
    private Integer reminderMaxPerDay = 6;

    @Column(name = "is_active")
    private Boolean isActive = true;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    @Transient
    public boolean isSystemRoutine() {
        return systemKey != null && !systemKey.isBlank();
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public ActivityCategory getCategory() { return category; }
    public void setCategory(ActivityCategory category) { this.category = category; }

    public ActivityFrequency getFrequency() { return frequency; }
    public void setFrequency(ActivityFrequency frequency) { this.frequency = frequency; }

    public Integer getIntervalDays() { return intervalDays; }
    public void setIntervalDays(Integer intervalDays) { this.intervalDays = intervalDays; }

    public String getDayOfWeek() { return dayOfWeek; }
    public void setDayOfWeek(String dayOfWeek) { this.dayOfWeek = dayOfWeek; }

    public String getDaysOfMonth() { return daysOfMonth; }
    public void setDaysOfMonth(String daysOfMonth) { this.daysOfMonth = daysOfMonth; }

    public LocalDate getAnchorDate() { return anchorDate; }
    public void setAnchorDate(LocalDate anchorDate) { this.anchorDate = anchorDate; }

    public LocalTime getDueTime() { return dueTime; }
    public void setDueTime(LocalTime dueTime) { this.dueTime = dueTime; }

    public Long getDefaultAssignedStaffId() { return defaultAssignedStaffId; }
    public void setDefaultAssignedStaffId(Long defaultAssignedStaffId) { this.defaultAssignedStaffId = defaultAssignedStaffId; }

    public String getSystemKey() { return systemKey; }
    public void setSystemKey(String systemKey) { this.systemKey = systemKey; }

    public String getActionRoute() { return actionRoute; }
    public void setActionRoute(String actionRoute) { this.actionRoute = actionRoute; }

    public String getChainId() { return chainId; }
    public void setChainId(String chainId) { this.chainId = chainId; }

    public Boolean getReminderEnabled() { return reminderEnabled; }
    public void setReminderEnabled(Boolean reminderEnabled) { this.reminderEnabled = reminderEnabled; }

    public Integer getReminderIntervalHours() { return reminderIntervalHours; }
    public void setReminderIntervalHours(Integer reminderIntervalHours) { this.reminderIntervalHours = reminderIntervalHours; }

    public LocalTime getReminderStartTime() { return reminderStartTime; }
    public void setReminderStartTime(LocalTime reminderStartTime) { this.reminderStartTime = reminderStartTime; }

    public LocalTime getReminderEndTime() { return reminderEndTime; }
    public void setReminderEndTime(LocalTime reminderEndTime) { this.reminderEndTime = reminderEndTime; }

    public Integer getReminderMaxPerDay() { return reminderMaxPerDay; }
    public void setReminderMaxPerDay(Integer reminderMaxPerDay) { this.reminderMaxPerDay = reminderMaxPerDay; }

    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean isActive) { this.isActive = isActive; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
