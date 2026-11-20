package com.dairy.dto.ration;

import lombok.Getter;
import lombok.Setter;

/** An active cow or buffalo as the ration plan sees it: the herd facts the batch rules use, and its batch. */
@Getter
@Setter
public class RationAnimalDTO {
    private Long id;
    private String animalName;
    private String tagNumber;
    private String animalType;
    private String animalStatus;
    private String breed;
    private Double bcs;
    /** Average litres per day over the last 7 full days, when there are at least 3 days of records. */
    private Double milk7Days;
    private Double avgMilk30Days;
    /** What the rules and the milk scaling use: the 7-day average, else the 30-day one. */
    private Double milkPerDay;
    private Integer dim;
    private Integer ageMonths;
    private Integer pregnancyDays;
    /** Batch the animal is fed in today, or null. */
    private Long groupId;
    /** True when put in groupId by hand rather than by a rule. */
    private boolean pinned;
    /** Batch the rules alone would choose today, or null; differs from groupId for pinned and held animals. */
    private Long ruleGroupId;
    /** First day in groupId, for animals the rules placed. */
    private java.time.LocalDate inBatchSince;
    /**
     * Set when the rules would move her but she joined her batch too recently: she stays in
     * groupId until this day, so her feed doesn't switch back and forth.
     */
    private java.time.LocalDate heldUntil;
}
