package com.dairy.model.ration;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/** A feeding batch (Peak, Mid, Late, Dry, Heifer, Calf): every animal in it eats the same ration. */
@Entity
@Table(name = "ration_groups")
@Getter
@Setter
public class RationGroup {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    /** Hex colour, so staff can find their batch at a glance. */
    @Column(length = 20)
    private String color;

    @Column(name = "sort_order")
    private Integer sortOrder = 0;

    /** Short instruction shown to staff under the batch, e.g. when to switch feed. */
    @Column(length = 1000)
    private String notes;

    /*
     * Rule that puts animals in this batch automatically, from their herd data. Every part that is
     * set must hold; a batch with no rule at all only holds the animals put in it by hand. An
     * animal goes to the first batch (in sort order) whose rule it meets.
     */

    /** Comma list of Herd.animalStatus values, e.g. "LACTATING" or "CALF,HEIFER". */
    @Column(name = "rule_statuses", length = 100)
    private String ruleStatuses;

    /** Milk per day, litres: the recent average (see RationService). */
    @Column(name = "rule_min_milk")
    private Double ruleMinMilk;

    @Column(name = "rule_max_milk")
    private Double ruleMaxMilk;

    /** Days in milk. */
    @Column(name = "rule_min_dim")
    private Integer ruleMinDim;

    @Column(name = "rule_max_dim")
    private Integer ruleMaxDim;

    /** Age in whole months, from the birth date. */
    @Column(name = "rule_min_age_months")
    private Integer ruleMinAgeMonths;

    @Column(name = "rule_max_age_months")
    private Integer ruleMaxAgeMonths;

    /**
     * Milk per day the ration lines are written for. When set, lines marked scaleWithMilk are
     * adjusted for each cow by her own yield (1 kg concentrate per 2.5 L for cows, per 2 L for
     * buffaloes); null leaves every line as typed.
     */
    @Column(name = "ref_milk")
    private Double refMilk;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = createdAt;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
