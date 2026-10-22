package com.dairy.service;

import com.dairy.dto.DewormingEntry;
import com.dairy.dto.DewormingRoundResult;
import com.dairy.dto.DewormingRoundRow;
import com.dairy.model.ActivityStatus;
import com.dairy.model.Herd;
import com.dairy.model.HerdEvent;
import com.dairy.model.User;
import com.dairy.repo.HerdEventRepository;
import com.dairy.repo.HerdRepository;
import com.dairy.repo.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class DewormingService {

    private static final Logger logger = LoggerFactory.getLogger(DewormingService.class);
    private static final ZoneId ZONE = ZoneId.of("Asia/Kolkata");

    @Autowired
    private HerdRepository herdRepo;

    @Autowired
    private HerdEventRepository eventRepo;

    @Autowired
    private FarmActivityService activityService;

    @Autowired
    private UserRepository userRepository;

    /** Every active animal in the round, ordered by due date so overdue ones come first. */
    public List<DewormingRoundRow> getRound() {
        LocalDate today = LocalDate.now(ZONE);

        List<Herd> herds = new ArrayList<>();
        for (Herd herd : herdRepo.findByStatus("ACTIVE")) {
            if (DewormingSchedule.applies(herd)) herds.add(herd);
        }
        if (herds.isEmpty()) return List.of();

        List<Long> ids = herds.stream().map(Herd::getId).toList();
        Map<Long, List<HerdEvent>> eventsByHerd = new HashMap<>();
        for (HerdEvent event : eventRepo.findByHerdIdInOrderByEventDateDesc(ids)) {
            eventsByHerd.computeIfAbsent(event.getHerdId(), k -> new ArrayList<>()).add(event);
        }

        List<DewormingRoundRow> rows = new ArrayList<>();
        for (Herd herd : herds) {
            DewormingSchedule.Next next = DewormingSchedule.compute(
                    herd, eventsByHerd.getOrDefault(herd.getId(), List.of()), today);
            long daysOverdue = ChronoUnit.DAYS.between(next.nextDue(), today);
            boolean doneToday = next.lastDone() != null && !next.lastDone().isBefore(today);
            rows.add(new DewormingRoundRow(
                    herd.getId(), herd.getTagNumber(), herd.getAnimalName(), herd.getAnimalType(),
                    herd.getBreed(), herd.getAnimalStatus(), herd.getImageUrl(), herd.getCalculatedAge(),
                    next.lastDone(), next.nextDue(), next.dose(), daysOverdue,
                    !doneToday && daysOverdue >= 0, doneToday));
        }
        rows.sort(Comparator.comparing(DewormingRoundRow::nextDueDate));
        return rows;
    }

    public long countDue() {
        return getRound().stream().filter(DewormingRoundRow::due).count();
    }

    /**
     * Records a deworming for each ticked animal. Saving the same animal and date twice is a
     * no-op. When nothing is left due, the chore behind the round is closed.
     */
    public DewormingRoundResult saveBulk(List<DewormingEntry> entries, Long logId) {
        LocalDate today = LocalDate.now(ZONE);
        Long staffId = currentStaffId();

        Map<Long, DewormingRoundRow> rowsById = new HashMap<>();
        for (DewormingRoundRow row : getRound()) rowsById.put(row.herdId(), row);

        int saved = 0;
        if (entries != null) {
            for (DewormingEntry entry : entries) {
                if (entry.herdId() == null) continue;
                DewormingRoundRow row = rowsById.get(entry.herdId());
                if (row == null) continue;

                LocalDate date = entry.date() != null ? entry.date() : today;
                if (date.isAfter(today)) date = today;
                final LocalDate doneOn = date;

                boolean duplicate = eventRepo.findByHerdIdOrderByEventDateDesc(entry.herdId()).stream()
                        .anyMatch(e -> DewormingSchedule.DONE_EVENT.equalsIgnoreCase(e.getEventType())
                                && doneOn.equals(e.getEventDate()));
                if (duplicate) continue;

                String details = row.dose() > 0 ? "Dose " + row.dose() : "Routine dose";
                if (staffId != null) details += " (recorded by staff #" + staffId + ")";
                eventRepo.save(new HerdEvent(entry.herdId(), doneOn, DewormingSchedule.DONE_EVENT,
                        "Deworming done", details));
                saved++;
            }
        }

        long stillDue = countDue();
        boolean taskCompleted = stillDue == 0 && completeTask(logId, staffId);
        return new DewormingRoundResult(saved, (int) stillDue, taskCompleted);
    }

    private boolean completeTask(Long logId, Long staffId) {
        if (logId == null) return false;
        try {
            if (activityService.getLog(logId).getStatus() == ActivityStatus.COMPLETED) return true;
            activityService.updateLogStatus(logId, ActivityStatus.COMPLETED, staffId,
                    "Completed automatically - every due animal has been dewormed.", null);
            return true;
        } catch (Exception ex) {
            logger.warn("Could not auto-complete chore {} after the deworming round", logId, ex);
            return false;
        }
    }

    private Long currentStaffId() {
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth == null || auth.getName() == null) return null;
            User user = userRepository.findByEmail(auth.getName())
                    .orElseGet(() -> userRepository.findByUsername(auth.getName()).orElse(null));
            return user != null ? user.getStaffId() : null;
        } catch (Exception ex) {
            return null;
        }
    }
}
