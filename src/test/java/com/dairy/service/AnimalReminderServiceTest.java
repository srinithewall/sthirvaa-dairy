package com.dairy.service;

import com.dairy.model.HerdEvent;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AnimalReminderServiceTest {

    private static final LocalDate DUE = LocalDate.of(2026, 11, 20);

    private static HerdEvent event(String type, LocalDate date) {
        return new HerdEvent(1L, date, type, type, null);
    }

    @Test
    void openWhenNothingRecorded() {
        assertFalse(AnimalReminderService.isHandled(event("VACCINATION_DUE", DUE), List.of()));
    }

    @Test
    void handledByMatchingWorkOnOrAfterTheDate() {
        HerdEvent reminder = event("VACCINATION_DUE", DUE);
        assertTrue(AnimalReminderService.isHandled(reminder, List.of(event("VACCINATION_DONE", DUE.plusDays(3)))));
    }

    @Test
    void handledByWorkUpToAFortnightEarly() {
        HerdEvent reminder = event("DEWORMING_DUE", DUE);
        assertTrue(AnimalReminderService.isHandled(reminder, List.of(event("DEWORMED", DUE.minusDays(14)))));
        assertFalse(AnimalReminderService.isHandled(reminder, List.of(event("DEWORMING_DONE", DUE.minusDays(15)))));
    }

    @Test
    void otherWorkDoesNotCount() {
        HerdEvent reminder = event("PREGNANCY_CHECK_DUE", DUE);
        assertFalse(AnimalReminderService.isHandled(reminder, List.of(event("VACCINATION_DONE", DUE))));
        assertTrue(AnimalReminderService.isHandled(reminder, List.of(event("PREGNANCY_NEGATIVE", DUE))));
    }

    @Test
    void aiReminderHandledByInsemination() {
        assertTrue(AnimalReminderService.isHandled(event("AI_DUE", DUE), List.of(event("SEMEN_GIVEN", DUE.plusDays(1)))));
    }
}
