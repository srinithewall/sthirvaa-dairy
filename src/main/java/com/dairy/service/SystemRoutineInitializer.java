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

    public static final String HERD_DEWORMING_KEY = "HERD_DEWORMING";
    public static final String HERD_DEWORMING_ROUTE = "/activities/deworming-round";

    public static final String ANIMAL_ONBOARDING_KEY = "ANIMAL_ONBOARDING";
    public static final String ANIMAL_ONBOARDING_ROUTE = "/activities/onboarding";

    public static final String ANIMAL_REMINDERS_KEY = "ANIMAL_REMINDERS";
    public static final String ANIMAL_REMINDERS_ROUTE = "/activities/animal-reminders";

    /** Every chore reminds three times a day: 8 am, 1 pm and 6 pm. */
    public static final int REMINDER_INTERVAL_HOURS = 5;
    public static final int REMINDER_MAX_PER_DAY = 3;
    public static final LocalTime REMINDER_START = LocalTime.of(8, 0);
    public static final LocalTime REMINDER_END = LocalTime.of(18, 0);

    /**
     * False on a local backend (SCHEDULER_ENABLED=false). It shares the production database, so a
     * routine seeded from here would be picked up by the deployed server before its page exists.
     */
    @org.springframework.beans.factory.annotation.Value("${app.scheduler.enabled:true}")
    private boolean schedulerEnabled;

    @Autowired
    private FarmActivityRepository activityRepository;

    @Override
    public void run(String... args) {
        seedHerdWeightRoutine();
        seedHerdDewormingRoutine();
        seedAnimalOnboardingRoutine();
        if (schedulerEnabled) seedAnimalRemindersRoutine();
    }

    /**
     * A daily chore for reminders set on animals (vaccination, deworming, PD check, AI) that have
     * fallen due. It closes itself when none is open (see AnimalRemindersCompletionCheck).
     */
    private void seedAnimalRemindersRoutine() {
        Optional<FarmActivity> existing = activityRepository.findBySystemKey(ANIMAL_REMINDERS_KEY);
        if (existing.isPresent()) {
            FarmActivity routine = existing.get();
            if (!ANIMAL_REMINDERS_ROUTE.equals(routine.getActionRoute())) {
                routine.setActionRoute(ANIMAL_REMINDERS_ROUTE);
                activityRepository.save(routine);
            }
            return;
        }

        FarmActivity routine = new FarmActivity();
        routine.setSystemKey(ANIMAL_REMINDERS_KEY);
        routine.setTitle("Animal health reminders");
        routine.setDescription("Vaccinations, dewormings, PD checks and AIs scheduled on animals that are due.");
        routine.setCategory(ActivityCategory.HERD_CHECK);
        routine.setFrequency(ActivityFrequency.DAILY);
        routine.setDueTime(REMINDER_START);
        routine.setActionRoute(ANIMAL_REMINDERS_ROUTE);
        applyThreeADay(routine);
        routine.setIsActive(true);

        activityRepository.save(routine);
        logger.info("Seeded system routine {}.", ANIMAL_REMINDERS_KEY);
    }

    /** Reminds at 8 am, 1 pm and 6 pm. */
    static void applyThreeADay(FarmActivity routine) {
        routine.setReminderEnabled(true);
        routine.setReminderIntervalHours(REMINDER_INTERVAL_HOURS);
        routine.setReminderStartTime(REMINDER_START);
        routine.setReminderEndTime(REMINDER_END);
        routine.setReminderMaxPerDay(REMINDER_MAX_PER_DAY);
    }

    /**
     * A daily chore for newly arrived animals that closes itself when no onboarding step is due
     * (see OnboardingCompletionCheck), so it only reminds while an animal needs something done.
     */
    private void seedAnimalOnboardingRoutine() {
        Optional<FarmActivity> existing = activityRepository.findBySystemKey(ANIMAL_ONBOARDING_KEY);
        if (existing.isPresent()) {
            FarmActivity routine = existing.get();
            if (!ANIMAL_ONBOARDING_ROUTE.equals(routine.getActionRoute())) {
                routine.setActionRoute(ANIMAL_ONBOARDING_ROUTE);
                activityRepository.save(routine);
            }
            return;
        }

        FarmActivity routine = new FarmActivity();
        routine.setSystemKey(ANIMAL_ONBOARDING_KEY);
        routine.setTitle("New animal onboarding");
        routine.setDescription("Quarantine care for newly arrived animals: vet check, deworming, feed change-over, vaccination.");
        routine.setCategory(ActivityCategory.HERD_CHECK);
        routine.setFrequency(ActivityFrequency.DAILY);
        routine.setDueTime(LocalTime.of(8, 0));
        routine.setActionRoute(ANIMAL_ONBOARDING_ROUTE);
        applyThreeADay(routine);
        routine.setIsActive(true);

        activityRepository.save(routine);
        logger.info("Seeded system routine {}.", ANIMAL_ONBOARDING_KEY);
    }

    /**
     * A daily chore that closes itself on days when no animal is due (see
     * HerdDewormingCompletionCheck), so staff are only nudged when there is deworming to record.
     */
    private void seedHerdDewormingRoutine() {
        Optional<FarmActivity> existing = activityRepository.findBySystemKey(HERD_DEWORMING_KEY);
        if (existing.isPresent()) {
            FarmActivity routine = existing.get();
            if (!HERD_DEWORMING_ROUTE.equals(routine.getActionRoute())) {
                routine.setActionRoute(HERD_DEWORMING_ROUTE);
                activityRepository.save(routine);
            }
            return;
        }

        FarmActivity routine = new FarmActivity();
        routine.setSystemKey(HERD_DEWORMING_KEY);
        routine.setTitle("Herd deworming");
        routine.setDescription("Record the deworming of every animal that is due.");
        routine.setCategory(ActivityCategory.HERD_CHECK);
        routine.setFrequency(ActivityFrequency.DAILY);
        routine.setDueTime(LocalTime.of(8, 0));
        routine.setActionRoute(HERD_DEWORMING_ROUTE);
        applyThreeADay(routine);
        routine.setIsActive(true);

        activityRepository.save(routine);
        logger.info("Seeded system routine {}.", HERD_DEWORMING_KEY);
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
        applyThreeADay(routine);
        routine.setIsActive(true);

        activityRepository.save(routine);
        logger.info("Seeded system routine {} on days {}.", HERD_WEIGHT_KEY, routine.getDaysOfMonth());
    }
}
