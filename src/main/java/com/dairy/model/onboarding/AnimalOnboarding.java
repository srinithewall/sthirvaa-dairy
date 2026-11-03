package com.dairy.model.onboarding;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * A newly arrived animal's settling-in period: quarantine, vet check, parasite control, a slow
 * move onto the farm ration and finally joining the herd. The steps come from OnboardingProtocol.
 */
@Entity
@Table(name = "animal_onboardings")
@Getter
@Setter
public class AnimalOnboarding {
    public static final String ACTIVE = "ACTIVE";
    public static final String COMPLETED = "COMPLETED";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "herd_id", nullable = false)
    private Long herdId;

    @Column(name = "arrival_date", nullable = false)
    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate arrivalDate;

    /** Days kept apart from the herd; the final check falls due on arrival + this. */
    @Column(name = "quarantine_days", nullable = false)
    private Integer quarantineDays = 14;

    /** ACTIVE while settling in, COMPLETED once it has joined the herd. */
    @Column(nullable = false, length = 20)
    private String status = ACTIVE;

    @Column(name = "completed_date")
    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate completedDate;

    @Column(length = 1000)
    private String notes;

    /** The QUARANTINE_STARTED event written to the animal's history when onboarding began. */
    @Column(name = "start_event_id")
    private Long startEventId;

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @JoinColumn(name = "onboarding_id", nullable = false)
    @OrderBy("sortOrder ASC")
    private List<OnboardingStep> steps = new ArrayList<>();

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    // Computed for the screen - see OnboardingService.decorate
    @Transient private String tagNumber;
    @Transient private String animalName;
    @Transient private String animalType;
    @Transient private String animalStatus;
    @Transient private String imageUrl;
    /** Days since arrival; the arrival day is day 0. */
    @Transient private Integer dayNumber;
    @Transient private Integer doneCount;
    @Transient private Integer totalCount;
    /** Steps that are due or overdue today. */
    @Transient private Integer dueCount;
    /** Share of the farm ration the animal should be on today, from the feed stages. */
    @Transient private Integer feedSharePct;
    /** Onboarded on the calf checklist. */
    @Transient private Boolean calf;
    /** Problems ticked in finished steps, e.g. "Fever, Loose dung" - shown on the card. */
    @Transient private String problems;

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
