package com.dairy.service;

import com.dairy.model.ActivityCategory;
import com.dairy.model.ActivityFrequency;
import com.dairy.model.FarmActivity;
import com.dairy.repo.FarmActivityRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.time.LocalTime;
import java.util.Optional;

/**
 * Seeds the routines the app owns. These cannot be deleted from the UI - only an admin can
 * reschedule or switch them off - so they are created once and then left alone.
 */
@Component("systemRoutineInitializer")
public class SystemRoutineInitializer implements CommandLineRunner {

    private static final Logger logger = LoggerFactory.getLogger(SystemRoutineInitializer.class);

    public static final String HERD_WEIGHT_KEY = "BIWEEKLY_HERD_WEIGHT";
    public static final String HERD_WEIGHT_ROUTE = "/activities/weight-round";

    @Autowired
    private FarmActivityRepository activityRepository;

    @Override
    public void run(String... args) {
        seedHerdWeightRoutine();
    }

    private void seedHerdWeightRoutine() {
        Optional<FarmActivity> existing = activityRepository.findBySystemKey(HERD_WEIGHT_KEY);
        if (existing.isPresent()) {
            // Keep the wiring current without disturbing the admin's schedule choices.
            FarmActivity routine = existing.get();
            if (!HERD_WEIGHT_ROUTE.equals(routine.getActionRoute())) {
                routine.setActionRoute(HERD_WEIGHT_ROUTE);
                activityRepository.save(routine);
            }
            return;
        }

        FarmActivity routine = new FarmActivity();
        routine.setSystemKey(HERD_WEIGHT_KEY);
        routine.setTitle("Herd weight measurement");
        routine.setDescription("Record the weight of every cow in the herd.");
        routine.setCategory(ActivityCategory.HERD_CHECK);
        routine.setFrequency(ActivityFrequency.BI_WEEKLY);
        routine.setDaysOfMonth(ActivityScheduleResolver.DEFAULT_BI_WEEKLY_DAYS);
        routine.setDueTime(LocalTime.of(8, 0));
        routine.setActionRoute(HERD_WEIGHT_ROUTE);
        routine.setReminderEnabled(true);
        routine.setReminderIntervalHours(2);
        routine.setReminderStartTime(LocalTime.of(6, 0));
        routine.setReminderEndTime(LocalTime.of(20, 0));
        routine.setReminderMaxPerDay(6);
        routine.setIsActive(true);

        activityRepository.save(routine);
        logger.info("Seeded system routine {} on days {}.", HERD_WEIGHT_KEY, routine.getDaysOfMonth());
    }
}
