package com.dairy.service;

import com.dairy.model.Role;
import com.dairy.model.User;
import com.dairy.repo.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The twice-daily run must import what AMCS returns, and a failing run must tell the admins
 * (without nagging on every run) rather than leaving the milk data silently stale.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AmcsSyncServiceTest {

    @Mock private AmcsClient amcsClient;
    @Mock private AmcsCollectionService amcsCollectionService;
    @Mock private UserRepository userRepository;
    @Mock private PushNotificationService pushNotificationService;

    private AmcsSyncService service;

    @BeforeEach
    void setUp() {
        service = new AmcsSyncService();
        ReflectionTestUtils.setField(service, "amcsClient", amcsClient);
        ReflectionTestUtils.setField(service, "amcsCollectionService", amcsCollectionService);
        ReflectionTestUtils.setField(service, "userRepository", userRepository);
        ReflectionTestUtils.setField(service, "pushNotificationService", pushNotificationService);
        ReflectionTestUtils.setField(service, "daysBack", 7);

        User admin = new User();
        admin.setUsername("admin");
        admin.setRole(Role.ADMIN);
        admin.setFcmToken("fcm-admin");
        User noToken = new User();
        noToken.setUsername("srini");
        noToken.setRole(Role.ADMIN);
        when(userRepository.findByRoleIn(List.of(Role.ADMIN))).thenReturn(List.of(admin, noToken));
    }

    @Test
    void importsTheFetchedRowsForTheLastSevenDays() {
        List<Map<String, Object>> rows = List.of(Map.of("memberCode", "05401290327"));
        when(amcsClient.fetch(any(), any())).thenReturn(rows);
        when(amcsCollectionService.importRows(rows)).thenReturn(Map.of("inserted", 1));

        Map<String, Object> out = service.sync(7);

        assertEquals(Map.of("inserted", 1), out);
        org.mockito.ArgumentCaptor<LocalDate> from = org.mockito.ArgumentCaptor.forClass(LocalDate.class);
        org.mockito.ArgumentCaptor<LocalDate> to = org.mockito.ArgumentCaptor.forClass(LocalDate.class);
        verify(amcsClient).fetch(from.capture(), to.capture());
        assertEquals(6, java.time.temporal.ChronoUnit.DAYS.between(from.getValue(), to.getValue()));
    }

    @Test
    void syncPropagatesFailuresToTheCaller() {
        when(amcsClient.fetch(any(), any())).thenThrow(new AmcsClient.AmcsAuthException("nope"));
        assertThrows(AmcsClient.AmcsAuthException.class, () -> service.sync(7));
    }

    @Test
    void aRejectedTokenAlertsAdminsOncePerDayAndSkipsThoseWithoutADevice() {
        when(amcsClient.fetch(any(), any())).thenThrow(new AmcsClient.AmcsAuthException("expired"));

        service.runScheduled("morning");
        service.runScheduled("evening");

        verify(pushNotificationService, times(1)).sendMobilePush(
            eq("fcm-admin"), eq("AMCS login expired"), anyString(), eq("admin"), anyMap());
        verify(pushNotificationService, never()).sendMobilePush(
            eq(null), anyString(), anyString(), eq("srini"), anyMap());
    }

    @Test
    void aSingleOutageDoesNotAlertButRepeatedOnesDo() {
        when(amcsClient.fetch(any(), any())).thenThrow(new AmcsClient.AmcsUnavailableException("down"));

        service.runScheduled("morning");
        service.runScheduled("evening");
        verify(pushNotificationService, never()).sendMobilePush(any(), any(), any(), any(), any());

        service.runScheduled("morning");
        verify(pushNotificationService, times(1)).sendMobilePush(
            eq("fcm-admin"), eq("AMCS sync failing"), anyString(), eq("admin"), anyMap());

        service.runScheduled("evening");
        verify(pushNotificationService, times(1)).sendMobilePush(
            eq("fcm-admin"), eq("AMCS sync failing"), anyString(), eq("admin"), anyMap());
    }

    @Test
    void aSuccessfulRunResetsTheOutageCount() {
        when(amcsClient.fetch(any(), any()))
            .thenThrow(new AmcsClient.AmcsUnavailableException("down"))
            .thenThrow(new AmcsClient.AmcsUnavailableException("down"))
            .thenReturn(List.of())
            .thenThrow(new AmcsClient.AmcsUnavailableException("down"))
            .thenThrow(new AmcsClient.AmcsUnavailableException("down"));
        when(amcsCollectionService.importRows(any())).thenReturn(Map.of());

        for (int i = 0; i < 5; i++) service.runScheduled("run");

        // Never three failures in a row, so no alert
        verify(pushNotificationService, never()).sendMobilePush(any(), any(), any(), any(), any());
    }
}
