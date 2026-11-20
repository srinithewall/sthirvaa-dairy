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
    void aReadingWithNeitherGirthNorWeightIsRejected() {
        HerdWeightRecord r = new HerdWeightRecord();
        r.setHerdId(7L);
        assertThrows(IllegalArgumentException.class, () -> service.addWeightRecord(r));
        verify(weightRepo, never()).save(any());
    }
}
