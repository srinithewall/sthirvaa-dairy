package com.dairy.service;

import com.dairy.model.Setting;
import com.dairy.repository.SettingRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Optional;

@Component
public class NotificationScheduler {

    private static final Logger logger = LoggerFactory.getLogger(NotificationScheduler.class);

    @Autowired
    private SettingRepository settingRepository;

    @Autowired
    private PushNotificationService pushNotificationService;

    // Check every minute at second 0
    @Scheduled(cron = "0 * * * * ?")
    public void runScheduler() {
        Optional<Setting> reminderTimeSetting = settingRepository.findById("milk_production_reminder_time");
        if (reminderTimeSetting.isEmpty() || reminderTimeSetting.get().getSettingValue() == null) {
            return;
        }

        String targetTimeStr = reminderTimeSetting.get().getSettingValue().trim();
        String currentTimeStr = LocalTime.now(ZoneId.of("Asia/Kolkata")).format(DateTimeFormatter.ofPattern("HH:mm"));

        if (currentTimeStr.equals(targetTimeStr)) {
            logger.info("Scheduler matched reminder time ({}). Triggering check...", targetTimeStr);
            pushNotificationService.checkAndSendProductionReminder();
        }
    }
}
