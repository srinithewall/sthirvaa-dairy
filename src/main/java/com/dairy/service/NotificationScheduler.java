package com.dairy.service;

import com.dairy.model.Setting;
import com.dairy.repository.SettingRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Optional;

@Component
public class NotificationScheduler {

    private static final Logger logger = LoggerFactory.getLogger(NotificationScheduler.class);

    private static final ZoneId ZONE = ZoneId.of("Asia/Kolkata");

    @Autowired
    private SettingRepository settingRepository;

    @Autowired
    private PushNotificationService pushNotificationService;

    @Autowired
    private FarmActivityService farmActivityService;

    @Autowired
    private ChoreReminderService choreReminderService;

    // Check every minute at second 0
    @Scheduled(cron = "0 * * * * ?")
    public void runScheduler() {
        Optional<Setting> reminderTimeSetting = settingRepository.findById("milk_production_reminder_time");
        if (reminderTimeSetting.isEmpty() || reminderTimeSetting.get().getSettingValue() == null) {
            return;
        }

        String targetTimeStr = reminderTimeSetting.get().getSettingValue().trim();
        String currentTimeStr = LocalTime.now(ZONE).format(DateTimeFormatter.ofPattern("HH:mm"));

        if (currentTimeStr.equals(targetTimeStr)) {
            logger.info("Scheduler matched reminder time ({}). Triggering check...", targetTimeStr);
            pushNotificationService.checkAndSendProductionReminder();
            pushNotificationService.checkAndSendEventReminders();
        }
    }

    /** Materialises the day's chores just after midnight IST and ages out anything left open. */
    @Scheduled(cron = "0 5 0 * * ?", zone = "Asia/Kolkata")
    public void generateDailyChores() {
        LocalDate today = LocalDate.now(ZONE);
        try {
            int created = farmActivityService.generateLogsForDate(today);
            int overdue = farmActivityService.markOverdue(today);
            logger.info("Daily chore generation for {}: {} created, {} marked overdue.", today, created, overdue);
        } catch (Exception ex) {
            logger.error("Daily chore generation failed for " + today, ex);
        }
    }

    /**
     * Drives the staff reminder cadence. Runs every 15 minutes; the per-chore interval and the
     * daily cap decide whether anything is actually sent.
     */
    @Scheduled(cron = "0 0/15 * * * ?", zone = "Asia/Kolkata")
    public void sweepChoreReminders() {
        try {
            choreReminderService.sweep();
        } catch (Exception ex) {
            logger.error("Chore reminder sweep failed", ex);
        }
    }
}
