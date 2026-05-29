package com.dairy.service;

import com.dairy.model.User;
import com.dairy.model.Setting;
import com.dairy.repo.UserRepository;
import com.dairy.repo.MilkRecordRepository;
import com.dairy.repository.SettingRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

@Service
public class PushNotificationService {

    private static final Logger logger = LoggerFactory.getLogger(PushNotificationService.class);

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private MilkRecordRepository milkRecordRepository;

    @Autowired
    private SettingRepository settingRepository;

    public void checkAndSendProductionReminder() {
        logger.info("Executing scheduled daily milk production record check...");

        // 1. Check if any milk records have been entered for today
        long recordsToday = milkRecordRepository.findByDate(LocalDate.now()).size();
        if (recordsToday > 0) {
            logger.info("Milk production has already been entered for today (Count: {}). No reminder needed.", recordsToday);
            return;
        }

        logger.warn("No milk production records found for today! Dispatching push notifications...");

        // 2. Fetch the target staff list from settings
        Optional<Setting> staffsSetting = settingRepository.findById("milk_production_reminder_staffs");
        if (staffsSetting.isEmpty() || staffsSetting.get().getSettingValue() == null || staffsSetting.get().getSettingValue().trim().isEmpty()) {
            logger.warn("No target staff members configured for reminder. Check 'milk_production_reminder_staffs' setting.");
            return;
        }

        String[] targetUsernames = staffsSetting.get().getSettingValue().split(",");
        List<String> usernamesList = Arrays.asList(targetUsernames);

        for (String username : usernamesList) {
            String cleanUsername = username.trim();
            Optional<User> userOpt = userRepository.findByUsername(cleanUsername);
            if (userOpt.isEmpty()) {
                // Try finding by email (since usernames might be stored as email/name)
                userOpt = userRepository.findByEmail(cleanUsername);
            }

            if (userOpt.isPresent()) {
                User user = userOpt.get();
                String token = user.getFcmToken();
                String title = "Milk Production Reminder";
                String message = "Attention: Daily milk production entry is missing. Please record the yields as soon as possible.";

                if (token != null && !token.trim().isEmpty()) {
                    sendMobilePush(token, title, message, cleanUsername);
                } else {
                    logger.warn("Staff user '{}' is configured for reminders but has no registered FCM token.", cleanUsername);
                }
            } else {
                logger.warn("Configured staff user '{}' not found in database.", cleanUsername);
            }
        }
    }

    private void sendMobilePush(String token, String title, String message, String username) {
        // Log the push payload prominently
        logger.info("==========================================================================");
        logger.info("SENDING PUSH NOTIFICATION OVER THE PHONE TO: {} ({})", username, token);
        logger.info("Title: {}", title);
        logger.info("Body: {}", message);
        logger.info("==========================================================================");

        // Here you would integrate Firebase Admin SDK:
        // Message fcmMessage = Message.builder()
        //     .setToken(token)
        //     .setNotification(Notification.builder().setTitle(title).setBody(message).build())
        //     .build();
        // FirebaseMessaging.getInstance().send(fcmMessage);
    }
}
