package com.dairy.service;

import com.dairy.model.Herd;
import com.dairy.model.HerdWeightRecord;
import com.dairy.model.MeasurementMethod;
import com.dairy.repo.HerdRepository;
import com.dairy.repo.HerdWeightRecordRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class HerdWeightServiceScaleTest {

    @Mock private HerdWeightRecordRepository weightRepo;
    @Mock private HerdRepository herdRepo;
    @Mock private HerdService herdService;

    @InjectMocks private HerdWeightService service;

    @Test
    void scaleWeightIsSavedWithoutGirthAndKeepsTheAnimalsLastGirth() {
        Herd herd = new Herd();
        herd.setId(7L);
        herd.setHeartGirth(180.0);
        when(herdRepo.findById(7L)).thenReturn(Optional.of(herd));
        when(weightRepo.save(any())).thenAnswer(i -> i.getArgument(0));

        HerdWeightRecord r = new HerdWeightRecord();
        r.setHerdId(7L);
        r.setWeightKg(452.0);

        HerdWeightRecord saved = service.addWeightRecord(r);

        assertEquals(452.0, saved.getWeightKg());
        assertEquals(MeasurementMethod.SCALE, saved.getMeasurementMethod());
        assertNull(saved.getHeartGirthCm());
        assertEquals(180.0, herd.getHeartGirth());
        verify(herdService, never()).estimateWeightKg(any(), any(), any());
        verify(herdRepo, never()).save(any());
    }

    @Test
    void aTapeReadingKeepsTheKgReadOffTheTapeAlongsideTheGirth() {
        Herd herd = new Herd();
        herd.setId(7L);
        when(herdRepo.findById(7L)).thenReturn(Optional.of(herd));
        when(weightRepo.save(any())).thenAnswer(i -> i.getArgument(0));

        HerdWeightRecord r = new HerdWeightRecord();
        r.setHerdId(7L);
        r.setMeasurementMethod(MeasurementMethod.HEART_GIRTH_TAPE);
        r.setHeartGirthCm(177.0);
        r.setWeightKg(447.0);

        HerdWeightRecord saved = service.addWeightRecord(r);

        assertEquals(447.0, saved.getWeightKg());
        assertEquals(177.0, saved.getHeartGirthCm());
        assertEquals(MeasurementMethod.HEART_GIRTH_TAPE, saved.getMeasurementMethod());
        assertEquals(177.0, herd.getHeartGirth());
        verify(herdService, never()).estimateWeightKg(any(), any(), any());
    }

    @Test
    void enteringTheSameDayAgainCorrectsThatDaysReading() {
        java.time.LocalDate day = java.time.LocalDate.of(2026, 11, 22);
        HerdWeightRecord earlier = new HerdWeightRecord();
        earlier.setId(1L); earlier.setHerdId(7L); earlier.setRecordDate(day.minusDays(14)); earlier.setWeightKg(378.0);
        HerdWeightRecord wrong = new HerdWeightRecord();
        wrong.setId(2L); wrong.setHerdId(7L); wrong.setRecordDate(day); wrong.setWeightKg(438.0); wrong.setNotes("typed in");
        when(weightRepo.findByHerdIdOrderByRecordDateDesc(7L)).thenReturn(java.util.List.of(wrong, earlier));
        when(weightRepo.findByHerdIdAndRecordDateBetweenOrderByRecordDateAsc(7L, day, day)).thenReturn(java.util.List.of(wrong));
        when(herdRepo.findById(7L)).thenReturn(Optional.of(new Herd()));
        when(weightRepo.save(any())).thenAnswer(i -> i.getArgument(0));

        HerdWeightRecord fix = new HerdWeightRecord();
        fix.setHerdId(7L);
        fix.setRecordDate(day);
        fix.setHeartGirthCm(172.0);
        fix.setWeightKg(414.0);

        HerdWeightRecord saved = service.addWeightRecord(fix);

        assertEquals(2L, saved.getId());                 // same record, corrected
        assertEquals(414.0, saved.getWeightKg());
        assertEquals(172.0, saved.getHeartGirthCm());
        assertEquals(36.0, saved.getWeightChangeKg());   // against 8 Nov, not against itself
        assertEquals("typed in", saved.getNotes());
    }

    @Test
    void aReadingCanBeMovedToTheDayItWasTakenWithItsGirth() {
        java.time.LocalDate wrongDay = java.time.LocalDate.of(2026, 11, 23);
        java.time.LocalDate rightDay = wrongDay.minusDays(1);
        HerdWeightRecord r = new HerdWeightRecord();
        r.setId(50L); r.setHerdId(7L); r.setRecordDate(wrongDay); r.setWeightKg(530.0);
        HerdWeightRecord before = new HerdWeightRecord();
        before.setId(39L); before.setHerdId(7L); before.setRecordDate(wrongDay.minusDays(15)); before.setWeightKg(550.0);
        when(weightRepo.findById(50L)).thenReturn(Optional.of(r));
        when(weightRepo.findByHerdIdAndRecordDateBetweenOrderByRecordDateAsc(7L, rightDay, rightDay)).thenReturn(java.util.List.of());
        when(weightRepo.findByHerdIdOrderByRecordDateDesc(7L)).thenReturn(java.util.List.of(r, before));
        when(weightRepo.save(any())).thenAnswer(i -> i.getArgument(0));
        Herd herd = new Herd();
        when(herdRepo.findById(7L)).thenReturn(Optional.of(herd));

        HerdWeightRecord change = new HerdWeightRecord();
        change.setRecordDate(rightDay);
        change.setHeartGirthCm(186.0);
        change.setMeasurementMethod(null);

        HerdWeightRecord saved = service.updateWeightRecord(7L, 50L, change).orElseThrow();

        assertEquals(rightDay, saved.getRecordDate());
        assertEquals(186.0, saved.getHeartGirthCm());
        assertEquals(530.0, saved.getWeightKg());
        assertEquals(-20.0, saved.getWeightChangeKg());
        assertEquals(186.0, herd.getHeartGirth());
    }

    @Test
    void aReadingCannotBeMovedOntoADayThatAlreadyHasOne() {
        java.time.LocalDate day = java.time.LocalDate.of(2026, 11, 22);
        HerdWeightRecord r = new HerdWeightRecord();
        r.setId(50L); r.setHerdId(7L); r.setRecordDate(day.plusDays(1)); r.setWeightKg(530.0);
        when(weightRepo.findById(50L)).thenReturn(Optional.of(r));
        when(weightRepo.findByHerdIdAndRecordDateBetweenOrderByRecordDateAsc(7L, day, day)).thenReturn(java.util.List.of(new HerdWeightRecord()));
        HerdWeightRecord change = new HerdWeightRecord();
        change.setRecordDate(day);
        assertThrows(IllegalStateException.class, () -> service.updateWeightRecord(7L, 50L, change));
        // Another animal's reading is not found
        assertTrue(service.updateWeightRecord(8L, 50L, change).isEmpty());
    }

    @Test
    void aReadingWithNeitherGirthNorWeightIsRejected() {
        HerdWeightRecord r = new HerdWeightRecord();
        r.setHerdId(7L);
        assertThrows(IllegalArgumentException.class, () -> service.addWeightRecord(r));
        verify(weightRepo, never()).save(any());
    }
}
