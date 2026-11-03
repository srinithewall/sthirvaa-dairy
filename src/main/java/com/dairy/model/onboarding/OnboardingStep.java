package com.dairy.model.onboarding;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

/** One task of an onboarding, due within a window of days after arrival. */
@Entity
@Table(name = "animal_onboarding_steps")
@Getter
@Setter
public class OnboardingStep {
    public static final String PENDING = "PENDING";
    public static final String DONE = "DONE";
    public static final String SKIPPED = "SKIPPED";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 1-5: the numbered step this belongs to (2 holds both tick medicine and deworming). */
    @Column(name = "step_no")
    private Integer stepNo;

    /** ARRIVAL, TICK_TREATMENT, DEWORMING, VET_CHECK, VACCINATION, RELEASE. */
    @Column(name = "step_key", nullable = false, length = 40)
    private String stepKey;

    @Column(nullable = false)
    private String title;

    /** Unused since the screen stopped showing explanations; kept for older rows. */
    @Column(length = 1000)
    private String detail;

    /** Answers to tap, separated by "|"; one starting with "!" is a problem. */
    @Column(length = 500)
    private String choices;

    @Column(name = "sort_order")
    private Integer sortOrder = 0;

    @Column(name = "start_date", nullable = false)
    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate startDate;

    @Column(name = "end_date", nullable = false)
    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate endDate;

    /** Unused since feed stages are worked out from the day; kept for older rows. */
    @Column(name = "feed_share_pct")
    private Integer feedSharePct;

    @Column(nullable = false, length = 20)
    private String status = PENDING;

    @Column(name = "done_date")
    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate doneDate;

    @Column(length = 500)
    private String notes;

    /** Problem answers chosen when the step was done, e.g. "Fever, Loose dung"; empty when all was well. */
    @Column(length = 300)
    private String problems;

    /** The herd event this step wrote (deworming, vaccination...), removed again on undo. */
    @Column(name = "event_id")
    private Long eventId;

    /** DONE, SKIPPED, UPCOMING, DUE or OVERDUE as of today. */
    @Transient
    private String state;
}
