package com.dairy.service;

import com.dairy.model.Role;
import com.dairy.model.User;
import com.dairy.repo.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;

/**
 * Fetches the latest AMCS collections and imports them. Run twice a day by AmcsSyncScheduler.
 *
 * Failures never throw out of the scheduled run, but they must not go unnoticed either: when
 * AMCS rejects our token the admins get a push (once a day), and repeated outages do the same.
 */
@Service
public class AmcsSyncService {

    private static final Logger logger = LoggerFactory.getLogger(AmcsSyncService.class);
    private static final ZoneId ZONE = ZoneId.of("Asia/Kolkata");
    /** Consecutive failed runs (not counting a bad token, which alerts at once) before alerting. */
    static final int OUTAGE_ALERT_AFTER = 3;

    @Autowired private AmcsClient amcsClient;
    @Autowired private AmcsCollectionService amcsCollectionService;
    @Autowired private UserRepository userRepository;
    @Autowired private PushNotificationService pushNotificationService;

    // Several days back, so a missed run or a late supervisor correction is picked up next time
    @Value("${amcs.sync.days-back:7}")
    private int daysBack;

    private int consecutiveFailures;
    private LocalDate lastAuthAlert;
    private LocalDate lastOutageAlert;

    /** Fetch the last {@code days} days (today included) and import them. Throws on failure. */
    public Map<String, Object> sync(int days) {
        LocalDate to = LocalDate.now(ZONE);
        LocalDate from = to.minusDays(Math.max(days, 1) - 1L);
        List<Map<String, Object>> rows = amcsClient.fetch(from, to);
        logger.info("AMCS {}..{}: {} rows fetched", from, to, rows.size());
        return amcsCollectionService.importRows(rows);
    }

    /** What the scheduler calls. Logs and alerts instead of throwing. */
    public void runScheduled(String label) {
        try {
            Map<String, Object> summary = sync(daysBack);
            consecutiveFailures = 0;
            logger.info("AMCS {} sync done: {}", label, summary);
        } catch (AmcsClient.AmcsAuthException ex) {
            consecutiveFailures++;
            logger.error("AMCS {} sync failed - login rejected: {}", label, ex.getMessage());
            LocalDate today = LocalDate.now(ZONE);
            if (!today.equals(lastAuthAlert)) {
                lastAuthAlert = today;
                alertAdmins("AMCS login expired",
                    "Milk collection sync from AMCS is not working: the login token was rejected. "
                        + "Milk data will not update until the AMCS credentials are refreshed.");
            }
        } catch (RuntimeException ex) {
            consecutiveFailures++;
            logger.error("AMCS {} sync failed ({} in a row): {}", label, consecutiveFailures, ex.getMessage(), ex);
            LocalDate today = LocalDate.now(ZONE);
            if (consecutiveFailures >= OUTAGE_ALERT_AFTER && !today.equals(lastOutageAlert)) {
                lastOutageAlert = today;
                alertAdmins("AMCS sync failing",
                    "Milk collection sync from AMCS has failed " + consecutiveFailures
                        + " times in a row. Check the server log.");
            }
        }
    }

    private void alertAdmins(String title, String message) {
        for (User admin : userRepository.findByRoleIn(List.of(Role.ADMIN))) {
            String token = admin.getFcmToken();
            if (token == null || token.isBlank()) continue;
            pushNotificationService.sendMobilePush(token, title, message, admin.getUsername(),
                Map.of("route", "/production"));
        }
    }
}
