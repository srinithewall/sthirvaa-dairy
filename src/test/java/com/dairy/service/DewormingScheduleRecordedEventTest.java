package com.dairy.service;

import com.dairy.model.Herd;
import com.dairy.model.HerdEvent;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * A deworming recorded from the animal page (DEWORMING_DONE) must count the same as one confirmed in
 * the deworming round (DEWORMED); otherwise the herd table shows "Never" and the animal stays due.
 */
class DewormingScheduleRecordedEventTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 10, 27);

    private static Herd adultCow() {
        Herd h = new Herd();
        h.setAnimalType("COW");
        return h; // no birth date: adult interval
    }

    @Test
    void dewormingRecordedFromTheAnimalPageCountsAsDone() {
        HerdEvent recorded = new HerdEvent(1L, LocalDate.of(2026, 9, 11), "DEWORMING_DONE", "Deworming Done (Routine)", null);

        DewormingSchedule.Next next = DewormingSchedule.compute(adultCow(), List.of(recorded), TODAY);

        assertEquals(LocalDate.of(2026, 9, 11), next.lastDone());
        assertEquals(LocalDate.of(2026, 12, 10), next.nextDue());
    }

    @Test
    void latestOfEitherKindWins() {
        HerdEvent round = new HerdEvent(1L, LocalDate.of(2026, 6, 20), "DEWORMED", "Deworming done", null);
        HerdEvent page = new HerdEvent(1L, LocalDate.of(2026, 9, 11), "DEWORMING_DONE", "Deworming Done (Routine)", null);

        assertEquals(LocalDate.of(2026, 9, 11), DewormingSchedule.compute(adultCow(), List.of(round, page), TODAY).lastDone());
    }

    @Test
    void scheduledDewormingIsNotDone() {
        HerdEvent scheduled = new HerdEvent(1L, LocalDate.of(2026, 9, 1), "DEWORMING_DUE", "Deworming Reminder", null);

        DewormingSchedule.Next next = DewormingSchedule.compute(adultCow(), List.of(scheduled), TODAY);

        assertEquals(null, next.lastDone());
        assertEquals(TODAY, next.nextDue());
    }
}
