package com.dairy.service;

import com.dairy.model.Herd;
import com.dairy.model.HerdEvent;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Set;

/**
 * When an animal is next due for deworming, worked out from its birth date and the deworming
 * it has already had. Young stock follow a fixed dose-by-age table; once past the table, and
 * for animals with no birth date, the interval is a flat number of days from the last dose.
 *
 * Change the numbers here and the dashboard, the round screen and the reminders all follow.
 */
public final class DewormingSchedule {

    /** Event type stored when staff confirm a deworming in the deworming round. */
    public static final String DONE_EVENT = "DEWORMED";

    /** Event type the animal page's "Deworming → Record" button saves; it means the same thing. */
    public static final String RECORDED_EVENT = "DEWORMING_DONE";

    /** True for a deworming that was given, whichever screen recorded it. */
    public static boolean isDone(HerdEvent event) {
        return event.getEventType() != null && (DONE_EVENT.equalsIgnoreCase(event.getEventType())
                || RECORDED_EVENT.equalsIgnoreCase(event.getEventType()));
    }

    /** Age in days at which each calf dose is due: dose 1 at 10 days, dose 2 at 30 days, and so on. */
    public static final int[] CALF_DOSE_AGES = {10, 30, 60, 90, 180, 270, 365};

    /** Days between doses for adults and for anything past the calf table. */
    public static final int ADULT_INTERVAL_DAYS = 90;

    /** A dose given within this many days of a milestone still counts for it, so an early dose is not repeated. */
    private static final int MIN_GAP_DAYS = 14;

    private static final Set<String> TYPES = Set.of("COW", "BUFFALO", "GOAT");

    private DewormingSchedule() {}

    /** Livestock that are dewormed; poultry and fish are not part of this round. */
    public static boolean applies(Herd herd) {
        return herd != null && herd.getAnimalType() != null
                && TYPES.contains(herd.getAnimalType().trim().toUpperCase());
    }

    /**
     * @param lastDone date of the latest recorded deworming, or null if never
     * @param nextDue  date the next dose is due; today for an adult that was never dewormed
     * @param dose     calf dose number (1-7), or 0 for the adult interval
     */
    public record Next(LocalDate lastDone, LocalDate nextDue, int dose) {}

    public static Next compute(Herd herd, List<HerdEvent> events, LocalDate today) {
        LocalDate last = null;
        for (HerdEvent event : events) {
            if (isDone(event) && event.getEventDate() != null
                    && (last == null || event.getEventDate().isAfter(last))) {
                last = event.getEventDate();
            }
        }

        LocalDate birth = herd.getBirthDate();
        if (birth != null) {
            long ageToday = ChronoUnit.DAYS.between(birth, today);
            int lastMilestone = CALF_DOSE_AGES[CALF_DOSE_AGES.length - 1];

            if (last == null) {
                // Never dewormed: dose 1 at 10 days, or today if that has already passed.
                if (ageToday < lastMilestone) {
                    LocalDate first = birth.plusDays(CALF_DOSE_AGES[0]);
                    return new Next(null, first.isAfter(today) ? first : today, 1);
                }
            } else {
                long ageAtLast = ChronoUnit.DAYS.between(birth, last);
                for (int i = 0; i < CALF_DOSE_AGES.length; i++) {
                    if (CALF_DOSE_AGES[i] > ageAtLast + MIN_GAP_DAYS) {
                        return new Next(last, birth.plusDays(CALF_DOSE_AGES[i]), i + 1);
                    }
                }
            }
        }

        LocalDate due = last == null ? today : last.plusDays(ADULT_INTERVAL_DAYS);
        return new Next(last, due, 0);
    }
}
