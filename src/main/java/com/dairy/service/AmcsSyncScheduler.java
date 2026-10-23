package com.dairy.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Pulls the society's milk collections twice a day: after the morning collection is in, and
 * after the evening one. Both switches must be on - app.scheduler.enabled (so a local backend
 * sharing the production database stays quiet, see NotificationScheduler) and amcs.sync.enabled.
 */
@Component
@ConditionalOnProperty(name = {"app.scheduler.enabled", "amcs.sync.enabled"}, havingValue = "true")
public class AmcsSyncScheduler {

    @Autowired
    private AmcsSyncService amcsSyncService;

    @Scheduled(cron = "${amcs.sync.morning-cron}", zone = "Asia/Kolkata")
    public void morningSync() {
        amcsSyncService.runScheduled("morning");
    }

    @Scheduled(cron = "${amcs.sync.evening-cron}", zone = "Asia/Kolkata")
    public void eveningSync() {
        amcsSyncService.runScheduled("evening");
    }
}
