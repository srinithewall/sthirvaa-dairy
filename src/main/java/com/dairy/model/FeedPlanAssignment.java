package com.dairy.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * Links a shared FeedPlan to one animal. A plan is a recipe; this table says who eats it.
 *
 * Replaces the old FeedPlan.herdId, which allowed only one animal per plan and forced the
 * UI to save N duplicate plans to feed a group. See docs/feed-plans-v2-spec.md.
 */
@Entity
@Table(
    name = "feed_plan_assignments",
    uniqueConstraints = @UniqueConstraint(
        name = "uk_feed_plan_assignment",
        columnNames = { "feed_plan_id", "herd_id" }
    )
)
public class FeedPlanAssignment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "feed_plan_id", nullable = false)
    private Long feedPlanId;

    @Column(name = "herd_id", nullable = false)
    private Long herdId;

    @Column(name = "assigned_at")
    private LocalDateTime assignedAt;

    public FeedPlanAssignment() {}

    public FeedPlanAssignment(Long feedPlanId, Long herdId) {
        this.feedPlanId = feedPlanId;
        this.herdId = herdId;
    }

    @PrePersist
    protected void onCreate() {
        if (assignedAt == null) assignedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getFeedPlanId() { return feedPlanId; }
    public void setFeedPlanId(Long feedPlanId) { this.feedPlanId = feedPlanId; }

    public Long getHerdId() { return herdId; }
    public void setHerdId(Long herdId) { this.herdId = herdId; }

    public LocalDateTime getAssignedAt() { return assignedAt; }
    public void setAssignedAt(LocalDateTime assignedAt) { this.assignedAt = assignedAt; }
}
