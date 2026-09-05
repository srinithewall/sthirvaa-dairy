package com.dairy.service;

import com.dairy.model.ActivityFrequency;
import com.dairy.model.ActivityStatus;
import com.dairy.model.FarmActivity;
import com.dairy.model.FarmActivityLog;
import com.dairy.repo.FarmActivityLogRepository;
import com.dairy.repo.FarmActivityRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Editing a routine must clean up occurrences already materialised for later dates, not just
 * today's - a stale future occurrence would otherwise show up on a day the routine no longer runs.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class FarmActivityServiceResyncTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 9, 6);

    @Mock
    private FarmActivityRepository activityRepository;

    @Mock
    private FarmActivityLogRepository logRepository;

    private FarmActivityService service;

    @BeforeEach
    void setUp() {
        service = new FarmActivityService();
        ReflectionTestUtils.setField(service, "activityRepository", activityRepository);
        ReflectionTestUtils.setField(service, "logRepository", logRepository);
        ReflectionTestUtils.setField(service, "scheduleResolver", new ActivityScheduleResolver());
        when(activityRepository.findByIsActiveTrue()).thenReturn(Collections.emptyList());
        when(logRepository.findByActivityIdAndDueDate(anyLong(), any())).thenReturn(new ArrayList<>());
    }

    private FarmActivity biWeekly(String daysOfMonth) {
        FarmActivity activity = new FarmActivity();
        activity.setId(2L);
        activity.setFrequency(ActivityFrequency.BI_WEEKLY);
        activity.setDaysOfMonth(daysOfMonth);
        activity.setIsActive(true);
        return activity;
    }

    private FarmActivityLog log(long id, LocalDate dueDate) {
        FarmActivityLog log = new FarmActivityLog();
        log.setId(id);
        log.setActivityId(2L);
        log.setDueDate(dueDate);
        log.setStatus(ActivityStatus.PENDING);
        return log;
    }

    @SuppressWarnings("unchecked")
    private List<FarmActivityLog> captureDeleted() {
        ArgumentCaptor<List<FarmActivityLog>> captor = ArgumentCaptor.forClass(List.class);
        verify(logRepository).deleteAll(captor.capture());
        return captor.getValue();
    }

    @Test
    void aFutureOccurrenceTheNewScheduleNoLongerWantsIsRemoved() {
        FarmActivity activity = biWeekly("1,15,30");
        // Materialised while the routine ran on the 20th; it now runs on 1/15/30.
        FarmActivityLog stale = log(5L, LocalDate.of(2026, 9, 20));
        FarmActivityLog stillValid = log(3L, LocalDate.of(2026, 9, 15));

        when(logRepository.findByActivityIdAndDueDateGreaterThanEqualAndStatusIn(
                2L, TODAY, Arrays.asList(ActivityStatus.PENDING)))
                .thenReturn(new ArrayList<>(Arrays.asList(stale, stillValid)));

        service.resyncOpenLogs(activity, TODAY);

        List<FarmActivityLog> deleted = captureDeleted();
        assertEquals(1, deleted.size());
        assertEquals(5L, deleted.get(0).getId());
    }

    @Test
    void aKeptOccurrencePicksUpTheNewDueTime() {
        FarmActivity activity = biWeekly("1,15,30");
        activity.setDueTime(LocalTime.of(9, 30));
        FarmActivityLog upcoming = log(3L, LocalDate.of(2026, 9, 15));

        when(logRepository.findByActivityIdAndDueDateGreaterThanEqualAndStatusIn(
                2L, TODAY, Arrays.asList(ActivityStatus.PENDING)))
                .thenReturn(new ArrayList<>(Collections.singletonList(upcoming)));

        service.resyncOpenLogs(activity, TODAY);

        assertEquals(LocalTime.of(9, 30), upcoming.getDueTime());
        verify(logRepository, never()).deleteAll(any());
    }

    @Test
    void switchingTheRoutineOffClearsEveryUpcomingOccurrence() {
        FarmActivity activity = biWeekly("1,15,30");
        activity.setIsActive(false);

        when(logRepository.findByActivityIdAndDueDateGreaterThanEqualAndStatusIn(
                2L, TODAY, Arrays.asList(ActivityStatus.PENDING)))
                .thenReturn(new ArrayList<>(Arrays.asList(
                        log(3L, LocalDate.of(2026, 9, 15)),
                        log(5L, LocalDate.of(2026, 9, 30)))));

        service.resyncOpenLogs(activity, TODAY);

        assertEquals(2, captureDeleted().size());
    }

    @Test
    void onlyPendingOccurrencesFromTodayOnwardsAreEvenConsidered() {
        FarmActivity activity = biWeekly("1,15,30");
        when(logRepository.findByActivityIdAndDueDateGreaterThanEqualAndStatusIn(
                any(), any(), any())).thenReturn(new ArrayList<>());

        service.resyncOpenLogs(activity, TODAY);

        // History and real misses must never be rewritten by a schedule change.
        verify(logRepository).findByActivityIdAndDueDateGreaterThanEqualAndStatusIn(
                2L, TODAY, Arrays.asList(ActivityStatus.PENDING));
        verify(logRepository, never()).findByDueDateBetween(any(), any());
    }

    @Test
    void todaysOccurrenceIsGeneratedWhenTheEditMakesItDueNow() {
        // The 6th is not in 1,15,30; the 6th IS in the new list, so today must appear.
        FarmActivity activity = biWeekly("6,20");
        when(logRepository.findByActivityIdAndDueDateGreaterThanEqualAndStatusIn(
                any(), any(), any())).thenReturn(new ArrayList<>());
        when(activityRepository.findByIsActiveTrue()).thenReturn(Collections.singletonList(activity));
        when(logRepository.findByDueDate(TODAY)).thenReturn(new ArrayList<>());

        service.resyncOpenLogs(activity, TODAY);

        ArgumentCaptor<List<FarmActivityLog>> captor = ArgumentCaptor.forClass(List.class);
        verify(logRepository).saveAll(captor.capture());
        List<FarmActivityLog> created = captor.getValue();
        assertEquals(1, created.size());
        assertTrue(created.get(0).getDueDate().isEqual(TODAY));
    }
}
