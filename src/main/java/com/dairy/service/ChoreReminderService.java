package com.dairy.service;

import com.dairy.model.ActivityStatus;
import com.dairy.model.FarmActivity;
import com.dairy.model.FarmActivityLog;
import com.dairy.model.Role;
import com.dairy.model.User;
import com.dairy.repo.FarmActivityLogRepository;
import com.dairy.repo.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Nags staff about farm chores that are still open. A chore keeps reminding until a staff
 * member marks it done - nothing completes it automatically.
 */
@Service
public class ChoreReminderService {

    private static final Logger logger = LoggerFactory.getLogger(ChoreReminderService.class);

    public static final ZoneId ZONE = ZoneId.of("Asia/Kolkata");

    private static final List<ActivityStatus> OPEN_STATUSES =
            Arrays.asList(ActivityStatus.PENDING, ActivityStatus.OVERDUE);

    private static final int DEFAULT_INTERVAL_HOURS = 2;
    private static final int DEFAULT_MAX_PER_DAY = 6;
    private static final LocalTime DEFAULT_WINDOW_START = LocalTime.of(6, 0);
    private static final LocalTime DEFAULT_WINDOW_END = LocalTime.of(20, 0);

    @Autowired
    private FarmActivityService activityService;

    @Autowired
    private FarmActivityLogRepository logRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PushNotificationService pushNotificationService;

    /** Completion rules by system key; routines without one are never closed automatically. */
    private final Map<String, ChoreCompletionCheck> completionChecks = new HashMap<>();

    @Autowired(required = false)
    public void setCompletionChecks(List<ChoreCompletionCheck> checks) {
        for (ChoreCompletionCheck check : checks) {
            completionChecks.put(check.systemKey(), check);
        }
    }

    /**
     * One sweep of the reminder engine. Generates today's chores, ages out yesterday's, then
     * pushes to staff for anything still open and due.
     */
    public void sweep() {
        LocalDateTime now = LocalDateTime.now(ZONE);
        LocalDate today = now.toLocalDate();

        activityService.generateLogsForDate(today);
        activityService.markOverdue(today);

        List<FarmActivityLog> openLogs =
                logRepository.findByDueDateLessThanEqualAndStatusIn(today, OPEN_STATUSES);
        if (openLogs.isEmpty()) return;

        List<User> staffUsers = staffUsersWithTokens();
        if (staffUsers.isEmpty()) {
            logger.debug("No STAFF users with an FCM token; skipping chore reminders.");
            return;
        }

        for (FarmActivityLog log : openLogs) {
            FarmActivity activity = null;
            try {
                activity = activityService.getActivity(log.getActivityId());
            } catch (Exception ex) {
                continue;
            }
            if (!isDue(activity, log, now)) continue;

            // The work may have been recorded elsewhere - one animal at a time from the animal
            // cards, say - so re-check before nagging about something already finished.
            if (closeIfAlreadyDone(activity, log)) continue;

            List<User> recipients = recipientsFor(log, staffUsers);
            if (recipients.isEmpty()) continue;

            Map<String, String> data = payloadFor(activity, log);
            String title = "Pending chore: " + activity.getTitle();
            String body = buildBody(activity, log, today);

            for (User user : recipients) {
                pushNotificationService.sendMobilePush(
                        user.getFcmToken(), title, body, user.getUsername(), data);
            }

            int sentToday = remindersSentToday(log, today);
            log.setLastReminderAt(now);
            log.setReminderCount(sentToday + 1);
            logRepository.save(log);
        }
    }

    /**
     * Closes a chore whose completion rule says the work is already recorded. Returns true when
     * the chore was closed and so needs no reminder.
     */
    private boolean closeIfAlreadyDone(FarmActivity activity, FarmActivityLog log) {
        ChoreCompletionCheck check = completionChecks.get(activity.getSystemKey());
        if (check == null) return false;

        try {
            if (!check.isSatisfied(log)) return false;
            activityService.updateLogStatus(
                    log.getId(), ActivityStatus.COMPLETED, null, check.completionNote(log));
            logger.info("Chore {} ({}) closed automatically - its completion rule is satisfied.",
                    log.getId(), activity.getTitle());
            return true;
        } catch (Exception ex) {
            // A failing rule must not silence the reminder - fall through and push as usual.
            logger.warn("Completion check for chore {} failed", log.getId(), ex);
            return false;
        }
    }

    /**
     * Sends one reminder to the calling user immediately, for testing.
     *
     * Ignores the 2h interval and the daytime window, and pushes regardless of role - so a chore
     * can be checked at any hour from any account. It deliberately does NOT record the send: the
     * real cadence and the daily cap are left untouched, so testing cannot eat the day's budget
     * or delay the genuine reminders.
     *
     * Only ever pushes to the caller's own device.
     */
    public Map<String, Object> sendTestReminderToCurrentUser(Long logId) {
        Map<String, Object> report = new HashMap<>();

        User user = currentUser();
        if (user == null) {
            report.put("sent", false);
            report.put("reason", "Could not identify the signed-in user.");
            return report;
        }
        report.put("recipient", user.getUsername());
        report.put("role", user.getRole() != null ? user.getRole().name() : null);

        FarmActivityLog log = resolveLog(logId);
        if (log == null) {
            report.put("sent", false);
            report.put("reason", "No open chore to remind about. Pass logId to target a specific one.");
            return report;
        }

        FarmActivity activity;
        try {
            activity = activityService.getActivity(log.getActivityId());
        } catch (Exception ex) {
            report.put("sent", false);
            report.put("reason", "The chore's routine could not be loaded.");
            return report;
        }

        String token = user.getFcmToken();
        if (token == null || token.trim().isEmpty()) {
            report.put("sent", false);
            report.put("reason", "This account has no FCM token registered. Open the app on the "
                    + "device and sign in as this user first.");
            return report;
        }

        if (!pushNotificationService.isPushConfigured()) {
            report.put("sent", false);
            report.put("reason", "Firebase is not configured on this server, so the push can be "
                    + "logged but not delivered. Expected on a local backend; on the deployed "
                    + "server it means the service account is missing.");
            return report;
        }

        Map<String, String> data = payloadFor(activity, log);
        pushNotificationService.sendMobilePush(
                token,
                "Pending chore: " + activity.getTitle(),
                buildBody(activity, log, LocalDate.now(ZONE)),
                user.getUsername(),
                data);

        report.put("sent", true);
        report.put("logId", log.getId());
        report.put("chore", activity.getTitle());
        report.put("dueDate", String.valueOf(log.getDueDate()));
        report.put("status", String.valueOf(log.getStatus()));
        report.put("route", data.get("route"));
        report.put("note", "Cadence untouched - this send does not count toward the daily cap.");
        return report;
    }

    /** The requested chore, or the longest-outstanding open one. */
    private FarmActivityLog resolveLog(Long logId) {
        if (logId != null) {
            try {
                return activityService.getLog(logId);
            } catch (Exception ex) {
                return null;
            }
        }
        List<FarmActivityLog> open = logRepository.findByDueDateLessThanEqualAndStatusIn(
                LocalDate.now(ZONE), OPEN_STATUSES);
        if (open.isEmpty()) return null;
        open.sort(Comparator.comparing(FarmActivityLog::getDueDate));
        return open.get(0);
    }

    private User currentUser() {
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth == null || auth.getName() == null) return null;
            return userRepository.findByEmail(auth.getName())
                    .orElseGet(() -> userRepository.findByUsername(auth.getName()).orElse(null));
        } catch (Exception ex) {
            return null;
        }
    }

    private boolean isDue(FarmActivity activity, FarmActivityLog log, LocalDateTime now) {
        if (activity == null || !Boolean.TRUE.equals(activity.getReminderEnabled())) return false;

        LocalTime nowTime = now.toLocalTime();
        LocalTime windowStart = activity.getReminderStartTime() != null
                ? activity.getReminderStartTime() : DEFAULT_WINDOW_START;
        LocalTime windowEnd = activity.getReminderEndTime() != null
                ? activity.getReminderEndTime() : DEFAULT_WINDOW_END;
        if (nowTime.isBefore(windowStart) || nowTime.isAfter(windowEnd)) return false;

        // A chore due later today should not be nagged about yet.
        LocalTime dueTime = log.getDueTime() != null ? log.getDueTime() : activity.getDueTime();
        if (dueTime != null && log.getDueDate().isEqual(now.toLocalDate()) && nowTime.isBefore(dueTime)) {
            return false;
        }

        int max = activity.getReminderMaxPerDay() != null && activity.getReminderMaxPerDay() > 0
                ? activity.getReminderMaxPerDay() : DEFAULT_MAX_PER_DAY;
        if (remindersSentToday(log, now.toLocalDate()) >= max) return false;

        if (log.getLastReminderAt() == null) return true;

        int intervalHours = activity.getReminderIntervalHours() != null && activity.getReminderIntervalHours() > 0
                ? activity.getReminderIntervalHours() : DEFAULT_INTERVAL_HOURS;
        // Allow a few minutes of slack so a 2h cadence is not pushed out by the sweep interval.
        long minutesSince = Duration.between(log.getLastReminderAt(), now).toMinutes();
        return minutesSince >= (intervalHours * 60L) - 5;
    }

    /** The daily cap resets each day, so a count carried over from yesterday reads as zero. */
    private int remindersSentToday(FarmActivityLog log, LocalDate today) {
        if (log.getLastReminderAt() == null) return 0;
        if (!log.getLastReminderAt().toLocalDate().isEqual(today)) return 0;
        return log.getReminderCount() == null ? 0 : log.getReminderCount();
    }

    /** Reminders go to staff only - an assigned chore to that person, an unassigned one to all. */
    private List<User> recipientsFor(FarmActivityLog log, List<User> staffUsers) {
        if (log.getAssignedStaffId() == null) return staffUsers;

        List<User> assigned = new ArrayList<>();
        for (User user : staffUsers) {
            if (log.getAssignedStaffId().equals(user.getStaffId())) {
                assigned.add(user);
            }
        }
        // An assignee who cannot be reached should not silence the chore for everyone else.
        return assigned.isEmpty() ? staffUsers : assigned;
    }

    private List<User> staffUsersWithTokens() {
        List<User> result = new ArrayList<>();
        for (User user : userRepository.findByRoleIn(Arrays.asList(Role.STAFF))) {
            String token = user.getFcmToken();
            if (token != null && !token.trim().isEmpty()) {
                result.add(user);
            }
        }
        return result;
    }

    private Map<String, String> payloadFor(FarmActivity activity, FarmActivityLog log) {
        Map<String, String> data = new HashMap<>();
        data.put("type", "CHORE");
        data.put("logId", String.valueOf(log.getId()));
        data.put("activityId", String.valueOf(activity.getId()));
        String route = activity.getActionRoute() != null && !activity.getActionRoute().isBlank()
                ? activity.getActionRoute()
                : "/activities";
        String separator = route.contains("?") ? "&" : "?";
        data.put("route", route + separator + "logId=" + log.getId());
        return data;
    }

    private String buildBody(FarmActivity activity, FarmActivityLog log, LocalDate today) {
        String when = log.getDueDate().isBefore(today)
                ? "overdue since " + log.getDueDate()
                : "due today";
        String description = activity.getDescription() != null && !activity.getDescription().isBlank()
                ? activity.getDescription() + " "
                : "";
        return description + "This task is " + when + ". Tap to complete it.";
    }
}
