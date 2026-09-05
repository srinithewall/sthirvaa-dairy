package com.dairy.model;

public enum ActivityFrequency {
    /** Every day. */
    DAILY,
    /** On each weekday listed in dayOfWeek. */
    WEEKLY,
    /** On each day-of-month listed in daysOfMonth (defaults to 1,15,30). */
    BI_WEEKLY,
    /** On each day-of-month listed in daysOfMonth. */
    MONTHLY,
    /** Every intervalDays days, counting from anchorDate. */
    CUSTOM_DAYS,
    /** One-off task on anchorDate. */
    ONCE
}
