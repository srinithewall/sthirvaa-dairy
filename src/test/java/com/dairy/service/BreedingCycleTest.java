package com.dairy.service;

import com.dairy.model.HerdEvent;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Days pregnant used to count from the latest AI or PD, whichever came last, so a PD restarted the
 * count and an AI from before the last calving still read as a pregnancy. These cases are the
 * herd's own patterns.
 */
class BreedingCycleTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 11, 8);

    private static HerdEvent ev(String date, String type) {
        return new HerdEvent(1L, LocalDate.parse(date), type, type, null);
    }

    @Test
    void confirmedPregnancyDatesFromTheInseminationNotThePd() {
        // Amudha: calved 21 Apr, AI 24 Jul, PD positive 4 Oct.
        BreedingCycle c = BreedingCycle.of(List.of(
                ev("2026-10-04", "PREGNANCY_CONFIRMED"), ev("2026-07-24", "SEMEN_GIVEN"), ev("2026-04-21", "CALF_DELIVERED")), TODAY);

        assertEquals(LocalDate.of(2026, 7, 24), c.conception());
        assertTrue(c.confirmed());
    }

    @Test
    void inseminationBeforeTheLastCalvingIsNotAPregnancy() {
        // Lakshmi: AI in Dec 2025, calved 23 Sep 2026 (entered twice), not inseminated since.
        BreedingCycle c = BreedingCycle.of(List.of(
                ev("2026-09-23", "CALF_DELIVERED"), ev("2026-09-23", "CALF_DELIVERED"), ev("2025-12-16", "SEMEN_GIVEN")), TODAY);

        assertEquals(LocalDate.of(2026, 9, 23), c.lastCalving());
        assertFalse(c.pregnant());
        assertEquals(0, c.inseminations());
    }

    @Test
    void repeatInseminationUsesTheLatest() {
        // Ganga: calved 27 May, AI 31 Jul, AI again 19 Oct, no PD yet.
        BreedingCycle c = BreedingCycle.of(List.of(
                ev("2026-10-19", "SEMEN_GIVEN"), ev("2026-07-31", "SEMEN_GIVEN"), ev("2026-05-27", "CALF_DELIVERED")), TODAY);

        assertEquals(LocalDate.of(2026, 10, 19), c.conception());
        assertFalse(c.confirmed());
        assertEquals(2, c.inseminations());
    }

    @Test
    void inseminationAfterAPdMeansThatPregnancyWasLost() {
        BreedingCycle c = BreedingCycle.of(List.of(
                ev("2026-03-01", "CALF_DELIVERED"), ev("2026-05-01", "SEMEN_GIVEN"),
                ev("2026-06-20", "PREGNANCY_CONFIRMED"), ev("2026-09-01", "SEMEN_GIVEN")), TODAY);

        assertEquals(LocalDate.of(2026, 9, 1), c.conception());
        assertFalse(c.confirmed());
    }

    @Test
    void scheduledFutureEventsAreIgnored() {
        BreedingCycle c = BreedingCycle.of(List.of(
                ev("2026-05-01", "CALF_DELIVERED"), ev("2026-12-01", "SEMEN_GIVEN")), TODAY);

        assertFalse(c.pregnant());
    }
}
