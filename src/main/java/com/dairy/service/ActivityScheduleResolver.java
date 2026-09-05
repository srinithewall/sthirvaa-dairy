package com.dairy.service;

import com.dairy.model.ActivityFrequency;
import com.dairy.model.FarmActivity;
import org.springframework.stereotype.Component;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.HashSet;
import java.util.Set;

/**
 * Decides whether a routine falls due on a given date.
 */
@Component
public class ActivityScheduleResolver {

    /** Days of month used when a BI_WEEKLY routine has not been configured explicitly. */
    public static final String DEFAULT_BI_WEEKLY_DAYS = "1,15,30";

    public boolean isDueOn(FarmActivity activity, LocalDate date) {
        if (activity == null || activity.getFrequency() == null) return false;

        ActivityFrequency frequency = activity.getFrequency();

        // A routine never fires before the date it was anchored to.
        if (activity.getAnchorDate() != null
                && frequency != ActivityFrequency.DAILY
                && frequency != ActivityFrequency.WEEKLY
                && date.isBefore(activity.getAnchorDate())) {
            return false;
        }

        switch (frequency) {
            case DAILY:
                return true;

            case WEEKLY:
                return weekdays(activity.getDayOfWeek()).contains(date.getDayOfWeek());

            case BI_WEEKLY: {
                String days = blankToNull(activity.getDaysOfMonth());
                return matchesDayOfMonth(days != null ? days : DEFAULT_BI_WEEKLY_DAYS, date);
            }

            case MONTHLY: {
                String days = blankToNull(activity.getDaysOfMonth());
                if (days != null) return matchesDayOfMonth(days, date);
                // Legacy rows without a configured day fall back to the anchor's day of month.
                if (activity.getAnchorDate() != null) {
                    return matchesDayOfMonth(String.valueOf(activity.getAnchorDate().getDayOfMonth()), date);
                }
                return date.getDayOfMonth() == 1;
            }

            case CUSTOM_DAYS: {
                int interval = activity.getIntervalDays() == null || activity.getIntervalDays() < 1
                        ? 1 : activity.getIntervalDays();
                LocalDate anchor = activity.getAnchorDate() != null
                        ? activity.getAnchorDate()
                        : (activity.getCreatedAt() != null ? activity.getCreatedAt().toLocalDate() : date);
                if (date.isBefore(anchor)) return false;
                return ChronoUnit.DAYS.between(anchor, date) % interval == 0;
            }

            case ONCE:
                return activity.getAnchorDate() != null && activity.getAnchorDate().equals(date);

            default:
                return false;
        }
    }

    /**
     * True when the date matches one of the configured days of month. A configured day
     * that does not exist in this month (e.g. 30 in February) fires on the last day instead.
     */
    private boolean matchesDayOfMonth(String csv, LocalDate date) {
        int lastDay = date.lengthOfMonth();
        int today = date.getDayOfMonth();
        for (String part : csv.split(",")) {
            String trimmed = part.trim();
            if (trimmed.isEmpty()) continue;
            int day;
            try {
                day = Integer.parseInt(trimmed);
            } catch (NumberFormatException ex) {
                continue;
            }
            if (day < 1) continue;
            int effectiveDay = Math.min(day, lastDay);
            if (effectiveDay == today) return true;
        }
        return false;
    }

    private Set<DayOfWeek> weekdays(String csv) {
        Set<DayOfWeek> days = new HashSet<>();
        if (csv == null) return days;
        for (String part : csv.split(",")) {
            String trimmed = part.trim().toUpperCase();
            if (trimmed.isEmpty()) continue;
            try {
                days.add(DayOfWeek.valueOf(trimmed));
            } catch (IllegalArgumentException ignored) {
                // Unknown weekday name in stored config - skip it rather than fail generation.
            }
        }
        return days;
    }

    private String blankToNull(String value) {
        return value == null || value.trim().isEmpty() ? null : value.trim();
    }
}
