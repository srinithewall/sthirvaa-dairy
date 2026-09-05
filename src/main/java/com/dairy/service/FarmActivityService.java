package com.dairy.service;

import com.dairy.model.ActivityStatus;
import com.dairy.model.FarmActivity;
import com.dairy.model.FarmActivityLog;
import com.dairy.model.Staff;
import com.dairy.repo.FarmActivityLogRepository;
import com.dairy.repo.FarmActivityRepository;
import com.dairy.repo.StaffRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class FarmActivityService {

    private static final Logger logger = LoggerFactory.getLogger(FarmActivityService.class);

    private static final List<ActivityStatus> OPEN_STATUSES =
            Arrays.asList(ActivityStatus.PENDING, ActivityStatus.OVERDUE);

    @Autowired
    private FarmActivityRepository activityRepository;

    @Autowired
    private FarmActivityLogRepository logRepository;

    @Autowired
    private StaffRepository staffRepository;

    @Autowired
    private ActivityScheduleResolver scheduleResolver;

    // --- Routines (templates) ---

    public List<FarmActivity> getAllActiveActivities() {
        return activityRepository.findByIsActiveTrue();
    }

    public FarmActivity getActivity(Long id) {
        return activityRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Routine not found: " + id));
    }

    public FarmActivity saveActivity(FarmActivity activity) {
        // Routines created through the API are always custom - the system key is ours to set.
        activity.setSystemKey(null);
        applyScheduleDefaults(activity);
        return activityRepository.save(activity);
    }

    /**
     * Edits an existing routine. System routines keep their identity (system key, action route,
     * category) and only an admin may change how they are scheduled.
     */
    public FarmActivity updateActivity(Long id, FarmActivity incoming) {
        FarmActivity existing = getActivity(id);
        boolean isSystem = existing.isSystemRoutine();

        if (isSystem && !isCurrentUserAdmin()) {
            throw new RoutineNotEditableException(
                    "Only an admin can change the schedule of the built-in routine: " + existing.getTitle());
        }

        if (incoming.getTitle() != null) existing.setTitle(incoming.getTitle());
        existing.setDescription(incoming.getDescription());

        if (!isSystem && incoming.getCategory() != null) {
            existing.setCategory(incoming.getCategory());
        }

        if (incoming.getFrequency() != null) existing.setFrequency(incoming.getFrequency());
        existing.setIntervalDays(incoming.getIntervalDays());
        existing.setDayOfWeek(incoming.getDayOfWeek());
        existing.setDaysOfMonth(incoming.getDaysOfMonth());
        existing.setAnchorDate(incoming.getAnchorDate());
        existing.setDueTime(incoming.getDueTime());
        existing.setDefaultAssignedStaffId(incoming.getDefaultAssignedStaffId());

        if (incoming.getReminderEnabled() != null) existing.setReminderEnabled(incoming.getReminderEnabled());
        if (incoming.getReminderIntervalHours() != null) existing.setReminderIntervalHours(incoming.getReminderIntervalHours());
        if (incoming.getReminderStartTime() != null) existing.setReminderStartTime(incoming.getReminderStartTime());
        if (incoming.getReminderEndTime() != null) existing.setReminderEndTime(incoming.getReminderEndTime());
        if (incoming.getReminderMaxPerDay() != null) existing.setReminderMaxPerDay(incoming.getReminderMaxPerDay());
        if (incoming.getIsActive() != null) existing.setIsActive(incoming.getIsActive());

        applyScheduleDefaults(existing);
        FarmActivity saved = activityRepository.save(existing);

        // The schedule may have moved - drop today's untouched occurrence and re-generate it.
        resyncOpenLogs(saved, LocalDate.now());
        return saved;
    }

    public void deactivateActivity(Long id) {
        FarmActivity activity = getActivity(id);
        if (activity.isSystemRoutine()) {
            throw new RoutineNotEditableException(
                    activity.getTitle() + " is a built-in routine and cannot be deleted. Switch it off instead.");
        }
        activity.setIsActive(false);
        activityRepository.save(activity);
        resyncOpenLogs(activity, LocalDate.now());
    }

    /** Fills in the defaults a frequency needs so generation has something to work with. */
    private void applyScheduleDefaults(FarmActivity activity) {
        if (activity.getFrequency() == null) return;
        switch (activity.getFrequency()) {
            case BI_WEEKLY:
                if (isBlank(activity.getDaysOfMonth())) {
                    activity.setDaysOfMonth(ActivityScheduleResolver.DEFAULT_BI_WEEKLY_DAYS);
                }
                break;
            case MONTHLY:
                if (isBlank(activity.getDaysOfMonth())) {
                    activity.setDaysOfMonth("1");
                }
                break;
            case CUSTOM_DAYS:
                if (activity.getIntervalDays() == null || activity.getIntervalDays() < 1) {
                    activity.setIntervalDays(1);
                }
                if (activity.getAnchorDate() == null) {
                    activity.setAnchorDate(LocalDate.now());
                }
                break;
            case WEEKLY:
                if (isBlank(activity.getDayOfWeek())) {
                    activity.setDayOfWeek(LocalDate.now().getDayOfWeek().name());
                }
                break;
            case ONCE:
                if (activity.getAnchorDate() == null) {
                    activity.setAnchorDate(LocalDate.now());
                }
                break;
            default:
                break;
        }
    }

    // --- Occurrences (logs / chores) ---

    public List<FarmActivityLog> getLogsForDate(LocalDate date) {
        return enrich(materialise(date));
    }

    /**
     * The day's occurrences plus anything still open from earlier days. The reminder engine
     * already nags about overdue chores, so leaving them off the checklist meant staff were
     * pushed about work they could not find in the app.
     */
    public List<FarmActivityLog> getLogsForDateIncludingOverdue(LocalDate date) {
        List<FarmActivityLog> logs = new ArrayList<>(logRepository.findByDueDateLessThanAndStatusIn(date, OPEN_STATUSES));
        logs.addAll(materialise(date));
        // Oldest first, so what has been waiting longest is at the top of the list.
        logs.sort(Comparator.comparing(FarmActivityLog::getDueDate));
        return enrich(logs);
    }

    private List<FarmActivityLog> materialise(LocalDate date) {
        List<FarmActivityLog> logs = logRepository.findByDueDate(date);
        // The nightly job normally has these already; re-read only if we actually had to create one.
        if (generateMissing(date, logs) > 0) {
            logs = logRepository.findByDueDate(date);
        }
        return new ArrayList<>(logs);
    }

    public List<FarmActivityLog> getLogsBetween(LocalDate start, LocalDate end) {
        return enrich(logRepository.findByDueDateBetween(start, end));
    }

    /** Past occurrences of one routine, newest first - the history view. */
    public List<FarmActivityLog> getHistoryForActivity(Long activityId) {
        return enrich(logRepository.findByActivityIdOrderByDueDateDesc(activityId));
    }

    public FarmActivityLog getLog(Long logId) {
        FarmActivityLog log = logRepository.findById(logId)
                .orElseThrow(() -> new IllegalArgumentException("Task not found: " + logId));
        List<FarmActivityLog> single = new ArrayList<>();
        single.add(log);
        return enrich(single).get(0);
    }

    public FarmActivityLog updateLogStatus(Long logId, ActivityStatus status, Long staffId, String notes) {
        FarmActivityLog log = logRepository.findById(logId)
                .orElseThrow(() -> new IllegalArgumentException("Task not found: " + logId));

        log.setStatus(status);
        if (status == ActivityStatus.COMPLETED || status == ActivityStatus.SKIPPED) {
            log.setCompletedDate(LocalDate.now());
            log.setCompletedAt(LocalDateTime.now());
            log.setCompletedByStaffId(staffId);
        } else {
            log.setCompletedDate(null);
            log.setCompletedAt(null);
            log.setCompletedByStaffId(null);
        }
        if (notes != null) log.setNotes(notes);
        return logRepository.save(log);
    }

    public FarmActivityLog assignLog(Long logId, Long staffId) {
        FarmActivityLog log = logRepository.findById(logId)
                .orElseThrow(() -> new IllegalArgumentException("Task not found: " + logId));
        log.setAssignedStaffId(staffId);
        return logRepository.save(log);
    }

    /** Creates any missing occurrences for the given date. Safe to call repeatedly. */
    public int generateLogsForDate(LocalDate date) {
        return generateMissing(date, logRepository.findByDueDate(date));
    }

    /**
     * Creates the occurrences the date is missing, given what already exists for it.
     * Callers that have already read the day's logs pass them in so we don't re-query.
     * Writes nothing once the day is materialised, which is the common case on a read.
     */
    private int generateMissing(LocalDate date, List<FarmActivityLog> existingForDate) {
        Set<Long> alreadyLogged = new HashSet<>();
        for (FarmActivityLog log : existingForDate) {
            alreadyLogged.add(log.getActivityId());
        }

        List<FarmActivityLog> fresh = new ArrayList<>();
        for (FarmActivity activity : activityRepository.findByIsActiveTrue()) {
            if (alreadyLogged.contains(activity.getId())) continue;
            if (!scheduleResolver.isDueOn(activity, date)) continue;

            FarmActivityLog log = new FarmActivityLog();
            log.setActivityId(activity.getId());
            log.setDueDate(date);
            log.setDueTime(activity.getDueTime());
            log.setAssignedStaffId(activity.getDefaultAssignedStaffId());
            log.setStatus(ActivityStatus.PENDING);
            fresh.add(log);
        }

        if (fresh.isEmpty()) return 0;
        logRepository.saveAll(fresh);
        return fresh.size();
    }

    /** Marks still-open occurrences from before today as overdue. */
    public int markOverdue(LocalDate today) {
        List<FarmActivityLog> stale = logRepository.findByDueDateLessThanAndStatusIn(
                today, Arrays.asList(ActivityStatus.PENDING));
        for (FarmActivityLog log : stale) {
            log.setStatus(ActivityStatus.OVERDUE);
        }
        logRepository.saveAll(stale);
        return stale.size();
    }

    public List<FarmActivityLog> getOpenLogsForDate(LocalDate date) {
        return enrich(logRepository.findByDueDateAndStatusIn(date, OPEN_STATUSES));
    }

    public FarmActivityLog saveLog(FarmActivityLog log) {
        return logRepository.save(log);
    }

    /**
     * After a routine is edited, occurrences already materialised for today or later may no
     * longer belong to the new schedule - or today's may now be missing.
     *
     * Only PENDING occurrences from today onwards are touched. Past occurrences are history and
     * an OVERDUE one is a real miss, so neither is rewritten by a change to the schedule.
     */
    void resyncOpenLogs(FarmActivity activity, LocalDate today) {
        try {
            boolean routineActive = Boolean.TRUE.equals(activity.getIsActive());
            List<FarmActivityLog> upcoming = logRepository.findByActivityIdAndDueDateGreaterThanEqualAndStatusIn(
                    activity.getId(), today, Arrays.asList(ActivityStatus.PENDING));

            List<FarmActivityLog> stale = new ArrayList<>();
            List<FarmActivityLog> kept = new ArrayList<>();
            for (FarmActivityLog log : upcoming) {
                if (!routineActive || !scheduleResolver.isDueOn(activity, log.getDueDate())) {
                    stale.add(log);
                } else {
                    log.setDueTime(activity.getDueTime());
                    kept.add(log);
                }
            }

            if (!stale.isEmpty()) logRepository.deleteAll(stale);
            if (!kept.isEmpty()) logRepository.saveAll(kept);

            // Today is the only date generated eagerly; later dates are materialised by the
            // nightly job when they arrive, against whatever the schedule says by then.
            if (routineActive
                    && scheduleResolver.isDueOn(activity, today)
                    && logRepository.findByActivityIdAndDueDate(activity.getId(), today).isEmpty()) {
                generateLogsForDate(today);
            }
        } catch (Exception ex) {
            logger.warn("Could not re-sync occurrences for routine {}", activity.getId(), ex);
        }
    }

    /**
     * Attaches routine and staff detail to each occurrence. Looks both up in one batch each,
     * rather than per row - this runs on every chores request, including the 60s alert poll.
     */
    private List<FarmActivityLog> enrich(List<FarmActivityLog> logs) {
        if (logs.isEmpty()) return logs;

        Set<Long> activityIds = new HashSet<>();
        Set<Long> staffIds = new HashSet<>();
        for (FarmActivityLog log : logs) {
            if (log.getActivityId() != null) activityIds.add(log.getActivityId());
            Long staffId = staffIdFor(log);
            if (staffId != null) staffIds.add(staffId);
        }

        Map<Long, FarmActivity> activities = new HashMap<>();
        for (FarmActivity activity : activityRepository.findAllById(activityIds)) {
            activities.put(activity.getId(), activity);
        }

        Map<Long, Staff> staff = new HashMap<>();
        if (!staffIds.isEmpty()) {
            for (Staff member : staffRepository.findAllById(staffIds)) {
                staff.put(member.getId(), member);
            }
        }

        for (FarmActivityLog log : logs) {
            FarmActivity activity = activities.get(log.getActivityId());
            if (activity != null) log.setActivityDetails(activity);

            Long staffId = staffIdFor(log);
            if (staffId != null) {
                Staff member = staff.get(staffId);
                if (member != null) log.setStaffDetails(member);
            }
        }
        return logs;
    }

    /** Whoever the occurrence should show: the assignee, or failing that whoever completed it. */
    private Long staffIdFor(FarmActivityLog log) {
        return log.getAssignedStaffId() != null ? log.getAssignedStaffId() : log.getCompletedByStaffId();
    }

    private boolean isCurrentUserAdmin() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) return false;
        return auth.getAuthorities().stream()
                .anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()) || "ADMIN".equals(a.getAuthority()));
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    /** Raised when a routine cannot be changed or removed by the caller. */
    public static class RoutineNotEditableException extends RuntimeException {
        public RoutineNotEditableException(String message) {
            super(message);
        }
    }
}
