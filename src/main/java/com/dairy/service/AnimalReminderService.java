package com.dairy.service;

import com.dairy.dto.AnimalReminderRow;
import com.dairy.model.Herd;
import com.dairy.model.HerdEvent;
import com.dairy.repo.HerdEventRepository;
import com.dairy.repo.HerdRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Reminders set on an animal (the Health tab's Scheduled Tasks) that have fallen due. A reminder
 * stays open until the matching work is recorded for that animal - a vaccination for a
 * vaccination reminder, a PD result for a PD check, and so on - or the reminder is deleted.
 */
@Service
public class AnimalReminderService {

    static final ZoneId ZONE = ZoneId.of("Asia/Kolkata");

    /** Each reminder type and the event types that mean the work was done. */
    static final Map<String, Set<String>> DONE_BY_REMINDER = Map.of(
            "VACCINATION_DUE", Set.of("VACCINATION_DONE"),
            "DEWORMING_DUE", Set.of(DewormingSchedule.RECORDED_EVENT, DewormingSchedule.DONE_EVENT),
            "PREGNANCY_CHECK_DUE", Set.of("PREGNANCY_CONFIRMED", "PREGNANCY_NEGATIVE"),
            "AI_DUE", Set.of("SEMEN_GIVEN", "AI_DONE"));

    /** Work recorded up to this many days before the reminder date still counts as doing it. */
    static final int EARLY_DAYS = 14;

    @Autowired
    private HerdEventRepository eventRepo;

    @Autowired
    private HerdRepository herdRepo;

    /** Open reminders due today or earlier, most overdue first. */
    public List<AnimalReminderRow> getDue() {
        return getDue(LocalDate.now(ZONE));
    }

    public List<AnimalReminderRow> getDue(LocalDate today) {
        List<HerdEvent> reminders = eventRepo.findByEventTypeInAndEventDateLessThanEqual(
                DONE_BY_REMINDER.keySet(), today);
        if (reminders.isEmpty()) return List.of();

        Map<Long, Herd> herds = new HashMap<>();
        for (Herd herd : herdRepo.findAllById(reminders.stream().map(HerdEvent::getHerdId).distinct().toList())) {
            if (herd.getStatus() == null || "ACTIVE".equalsIgnoreCase(herd.getStatus())) herds.put(herd.getId(), herd);
        }
        if (herds.isEmpty()) return List.of();

        Map<Long, List<HerdEvent>> historyByHerd = new HashMap<>();
        for (HerdEvent event : eventRepo.findByHerdIdInOrderByEventDateDesc(herds.keySet())) {
            historyByHerd.computeIfAbsent(event.getHerdId(), k -> new ArrayList<>()).add(event);
        }

        List<AnimalReminderRow> rows = new ArrayList<>();
        for (HerdEvent reminder : reminders) {
            Herd herd = herds.get(reminder.getHerdId());
            if (herd == null) continue;
            if (isHandled(reminder, historyByHerd.getOrDefault(herd.getId(), List.of()))) continue;
            rows.add(new AnimalReminderRow(
                    reminder.getId(), herd.getId(), herd.getTagNumber(), herd.getAnimalName(),
                    herd.getAnimalStatus(), herd.getImageUrl(), reminder.getEventType(), reminder.getTitle(),
                    reminder.getEventDate(), ChronoUnit.DAYS.between(reminder.getEventDate(), today)));
        }
        rows.sort(Comparator.comparing(AnimalReminderRow::dueDate).thenComparing(AnimalReminderRow::herdId));
        return rows;
    }

    public long countDue() {
        return getDue().size();
    }

    /** True when the animal has the reminder's work recorded on or after a fortnight before its date. */
    static boolean isHandled(HerdEvent reminder, List<HerdEvent> history) {
        Set<String> doneTypes = DONE_BY_REMINDER.get(reminder.getEventType());
        if (doneTypes == null || reminder.getEventDate() == null) return false;
        LocalDate from = reminder.getEventDate().minusDays(EARLY_DAYS);
        for (HerdEvent event : history) {
            if (event.getEventType() == null || event.getEventDate() == null) continue;
            if (doneTypes.contains(event.getEventType().toUpperCase()) && !event.getEventDate().isBefore(from)) {
                return true;
            }
        }
        return false;
    }
}
