package com.dairy.service;

import com.dairy.dto.WeightRoundRow;
import com.dairy.model.FarmActivityLog;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class HerdWeightRoundCompletionCheckTest {

    @Mock
    private HerdWeightService weightService;

    @InjectMocks
    private HerdWeightRoundCompletionCheck check;

    private FarmActivityLog log;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(check, "weightService", weightService);
        log = new FarmActivityLog();
        log.setId(99L);
        log.setDueDate(LocalDate.of(2026, 9, 15));
    }

    private WeightRoundRow row(boolean measured) {
        WeightRoundRow r = new WeightRoundRow();
        r.setMeasuredInRound(measured);
        return r;
    }

    @Test
    void satisfiedOnlyWhenEveryAnimalHasBeenMeasured() {
        when(weightService.getWeightRound(any())).thenReturn(Arrays.asList(row(true), row(true), row(true)));
        assertTrue(check.isSatisfied(log));
    }

    @Test
    void notSatisfiedWhileOneAnimalIsOutstanding() {
        when(weightService.getWeightRound(any())).thenReturn(Arrays.asList(row(true), row(false), row(true)));
        assertFalse(check.isSatisfied(log));
    }

    @Test
    void anEmptyHerdNeverSatisfiesTheRule() {
        // Guards against closing the chore because nothing was found to measure.
        when(weightService.getWeightRound(any())).thenReturn(new ArrayList<>());
        assertFalse(check.isSatisfied(log));
    }

    @Test
    void theRoundIsJudgedAgainstTheDueDateNotToday() {
        List<WeightRoundRow> all = Arrays.asList(row(true));
        when(weightService.getWeightRound(LocalDate.of(2026, 9, 15))).thenReturn(all);

        assertTrue(check.isSatisfied(log));
    }

    @Test
    void itAnswersForTheHerdWeightSystemRoutine() {
        org.junit.jupiter.api.Assertions.assertEquals(
                SystemRoutineInitializer.HERD_WEIGHT_KEY, check.systemKey());
    }
}
