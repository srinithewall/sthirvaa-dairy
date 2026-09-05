package com.dairy.service;

import com.dairy.model.ActivityFrequency;
import com.dairy.model.FarmActivity;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ActivityScheduleResolverTest {

    private final ActivityScheduleResolver resolver = new ActivityScheduleResolver();

    private FarmActivity routine(ActivityFrequency frequency) {
        FarmActivity activity = new FarmActivity();
        activity.setFrequency(frequency);
        return activity;
    }

    @Test
    void biWeeklyFiresOnTheConfiguredDaysOfMonth() {
        FarmActivity activity = routine(ActivityFrequency.BI_WEEKLY);
        activity.setDaysOfMonth("1,15,30");

        assertTrue(resolver.isDueOn(activity, LocalDate.of(2026, 9, 1)));
        assertTrue(resolver.isDueOn(activity, LocalDate.of(2026, 9, 15)));
        assertTrue(resolver.isDueOn(activity, LocalDate.of(2026, 9, 30)));

        assertFalse(resolver.isDueOn(activity, LocalDate.of(2026, 9, 2)));
        assertFalse(resolver.isDueOn(activity, LocalDate.of(2026, 9, 14)));
        assertFalse(resolver.isDueOn(activity, LocalDate.of(2026, 9, 29)));
    }

    @Test
    void biWeeklyDefaultsToTheFirstFifteenthAndThirtiethWhenNotConfigured() {
        FarmActivity activity = routine(ActivityFrequency.BI_WEEKLY);

        assertTrue(resolver.isDueOn(activity, LocalDate.of(2026, 9, 15)));
        assertFalse(resolver.isDueOn(activity, LocalDate.of(2026, 9, 16)));
    }

    @Test
    void aDayTheMonthDoesNotHaveFallsOnTheLastDay() {
        FarmActivity activity = routine(ActivityFrequency.BI_WEEKLY);
        activity.setDaysOfMonth("1,15,30");

        // February 2027 has 28 days, so the 30th lands on the 28th - and only there.
        assertTrue(resolver.isDueOn(activity, LocalDate.of(2027, 2, 28)));
        assertFalse(resolver.isDueOn(activity, LocalDate.of(2027, 2, 27)));

        // A leap February pushes the same day to the 29th.
        assertTrue(resolver.isDueOn(activity, LocalDate.of(2028, 2, 29)));
        assertFalse(resolver.isDueOn(activity, LocalDate.of(2028, 2, 28)));
    }

    @Test
    void a31DayMonthStillFiresOnceForDay30() {
        FarmActivity activity = routine(ActivityFrequency.BI_WEEKLY);
        activity.setDaysOfMonth("1,15,30");

        assertTrue(resolver.isDueOn(activity, LocalDate.of(2026, 10, 30)));
        assertFalse(resolver.isDueOn(activity, LocalDate.of(2026, 10, 31)));
    }

    @Test
    void weeklyFiresOnEachListedWeekday() {
        FarmActivity activity = routine(ActivityFrequency.WEEKLY);
        activity.setDayOfWeek("MONDAY,THURSDAY");

        assertTrue(resolver.isDueOn(activity, LocalDate.of(2026, 9, 7)));   // Monday
        assertTrue(resolver.isDueOn(activity, LocalDate.of(2026, 9, 10)));  // Thursday
        assertFalse(resolver.isDueOn(activity, LocalDate.of(2026, 9, 8)));  // Tuesday
    }

    @Test
    void customDaysCountsFromTheAnchorDate() {
        FarmActivity activity = routine(ActivityFrequency.CUSTOM_DAYS);
        activity.setIntervalDays(3);
        activity.setAnchorDate(LocalDate.of(2026, 9, 1));

        assertTrue(resolver.isDueOn(activity, LocalDate.of(2026, 9, 1)));
        assertTrue(resolver.isDueOn(activity, LocalDate.of(2026, 9, 4)));
        assertFalse(resolver.isDueOn(activity, LocalDate.of(2026, 9, 5)));
        // Never before the anchor.
        assertFalse(resolver.isDueOn(activity, LocalDate.of(2026, 8, 29)));
    }

    @Test
    void onceFiresOnlyOnItsDate() {
        FarmActivity activity = routine(ActivityFrequency.ONCE);
        activity.setAnchorDate(LocalDate.of(2026, 9, 20));

        assertTrue(resolver.isDueOn(activity, LocalDate.of(2026, 9, 20)));
        assertFalse(resolver.isDueOn(activity, LocalDate.of(2026, 9, 21)));
    }

    @Test
    void dailyFiresEveryDayAndAnUnsetFrequencyNeverDoes() {
        assertTrue(resolver.isDueOn(routine(ActivityFrequency.DAILY), LocalDate.of(2026, 9, 6)));
        assertFalse(resolver.isDueOn(new FarmActivity(), LocalDate.of(2026, 9, 6)));
        assertFalse(resolver.isDueOn(null, LocalDate.of(2026, 9, 6)));
    }
}
