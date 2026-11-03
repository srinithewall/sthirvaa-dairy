package com.dairy.service;

import com.dairy.model.ActivityStatus;
import com.dairy.model.Herd;
import com.dairy.model.HerdEvent;
import com.dairy.model.onboarding.AnimalOnboarding;
import com.dairy.model.onboarding.OnboardingStep;
import com.dairy.repo.HerdEventRepository;
import com.dairy.repo.HerdRepository;
import com.dairy.repo.onboarding.AnimalOnboardingRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Onboarding of newly arrived animals. Health steps that matter elsewhere write herd events, so
 * a deworming done here counts for the deworming schedule and a deworming recorded elsewhere
 * after arrival ticks the step here.
 */
@Service
public class OnboardingService {

    private static final Logger logger = LoggerFactory.getLogger(OnboardingService.class);
    private static final ZoneId ZONE = ZoneId.of("Asia/Kolkata");

    /** Completed onboardings stay on the screen this long, so a just-released animal does not vanish. */
    private static final int RECENT_DAYS = 14;

    @Autowired
    private AnimalOnboardingRepository onboardingRepo;

    @Autowired
    private HerdRepository herdRepo;

    @Autowired
    private HerdEventRepository eventRepo;

    @Autowired
    private FarmActivityService activityService;

    private LocalDate today() { return LocalDate.now(ZONE); }

    /** Animals settling in, then those that joined the herd in the last two weeks. */
    @Transactional
    public List<AnimalOnboarding> list() {
        List<AnimalOnboarding> result = new ArrayList<>(onboardingRepo.findByStatusOrderByArrivalDateDesc(AnimalOnboarding.ACTIVE));
        LocalDate since = today().minusDays(RECENT_DAYS);
        for (AnimalOnboarding o : onboardingRepo.findByStatusOrderByArrivalDateDesc(AnimalOnboarding.COMPLETED)) {
            if (o.getCompletedDate() != null && !o.getCompletedDate().isBefore(since)) result.add(o);
        }
        Map<Long, Herd> herds = herdsOf(result);
        // An animal disposed of during quarantine drops off the list
        result.removeIf(o -> {
            Herd herd = herds.get(o.getHerdId());
            return herd == null || (AnimalOnboarding.ACTIVE.equals(o.getStatus()) && !"ACTIVE".equals(herd.getStatus()));
        });
        for (AnimalOnboarding o : result) {
            keepCurrent(o, herds.get(o.getHerdId()));
            syncFromHistory(o);
        }
        result.forEach(o -> decorate(o, herds.get(o.getHerdId())));
        return result;
    }

    /** The animal's latest onboarding, or empty if it never had one. */
    @Transactional
    public Optional<AnimalOnboarding> forHerd(Long herdId) {
        return onboardingRepo.findByHerdIdOrderByArrivalDateDesc(herdId).stream().findFirst().map(o -> {
            Herd herd = herdRepo.findById(herdId).orElse(null);
            keepCurrent(o, herd);
            syncFromHistory(o);
            decorate(o, herd);
            return o;
        });
    }

    @Transactional
    public AnimalOnboarding start(Long herdId, LocalDate arrival, Integer quarantineDays, String notes) {
        Herd herd = herdRepo.findById(herdId)
                .orElseThrow(() -> new IllegalArgumentException("Animal not found: " + herdId));
        if (!OnboardingProtocol.applies(herd)) {
            throw new IllegalArgumentException("Onboarding is for cattle, buffalo and goats only.");
        }
        if (onboardingRepo.existsByHerdIdAndStatus(herdId, AnimalOnboarding.ACTIVE)) {
            throw new IllegalStateException((herd.getAnimalName() != null ? herd.getAnimalName() : herd.getTagNumber())
                    + " is already being onboarded.");
        }

        AnimalOnboarding o = new AnimalOnboarding();
        o.setHerdId(herdId);
        o.setArrivalDate(arrival != null ? arrival : today());
        o.setQuarantineDays(validDays(quarantineDays));
        o.setNotes(blankToNull(notes));

        syncWithProtocol(o, herd);

        HerdEvent started = eventRepo.save(new HerdEvent(herdId, o.getArrivalDate(), OnboardingProtocol.STARTED_EVENT,
                "Arrived - quarantine started", o.getQuarantineDays() + "-day quarantine and onboarding"));
        o.setStartEventId(started.getId());

        AnimalOnboarding saved = onboardingRepo.save(o);
        decorate(saved, herd);
        return saved;
    }

    /** Moves the arrival date or quarantine length; the step dates follow. */
    @Transactional
    public AnimalOnboarding update(Long id, LocalDate arrival, Integer quarantineDays, String notes) {
        AnimalOnboarding o = onboardingRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Onboarding not found: " + id));
        if (arrival != null) o.setArrivalDate(arrival);
        if (quarantineDays != null) o.setQuarantineDays(validDays(quarantineDays));
        o.setNotes(blankToNull(notes));
        Herd herd = herdRepo.findById(o.getHerdId()).orElse(null);
        if (herd != null) syncWithProtocol(o, herd);
        if (o.getStartEventId() != null) {
            eventRepo.findById(o.getStartEventId()).ifPresent(e -> {
                e.setEventDate(o.getArrivalDate());
                e.setDetails(o.getQuarantineDays() + "-day quarantine and onboarding");
                eventRepo.save(e);
            });
        }
        AnimalOnboarding saved = onboardingRepo.save(o);
        decorate(saved, herdRepo.findById(saved.getHerdId()).orElse(null));
        return saved;
    }

    /**
     * Ticks, skips or reopens a step. The tapped answers become the step's notes, and any of them
     * that are problems ("!" in the protocol) are kept apart so the screen can flag them.
     * The arrival check can be marked again on any day; each time is kept as a dated health
     * check in the animal's history, and undo goes back to the check before.
     * Finishing the final step completes the onboarding.
     * With a chore logId, the chore is closed once no onboarding step is due anywhere.
     */
    @Transactional
    public AnimalOnboarding updateStep(Long stepId, String status, LocalDate doneDate, List<String> answers,
                                       String notes, Long logId) {
        AnimalOnboarding o = onboardingRepo.findByStepId(stepId)
                .orElseThrow(() -> new IllegalArgumentException("Step not found: " + stepId));
        OnboardingStep step = o.getSteps().stream().filter(s -> s.getId().equals(stepId)).findFirst().orElseThrow();
        String next = status == null ? OnboardingStep.DONE : status.toUpperCase();
        if (!Set.of(OnboardingStep.DONE, OnboardingStep.SKIPPED, OnboardingStep.PENDING).contains(next)) {
            throw new IllegalArgumentException("Unknown step status: " + status);
        }

        LocalDate date = doneDate != null ? doneDate : today();
        if (date.isAfter(today())) date = today();

        boolean repeatable = OnboardingProtocol.ARRIVAL.equals(step.getStepKey());
        if (repeatable && OnboardingStep.PENDING.equals(next)) {
            undoLatestCheck(o, step);
        } else {
            if (!repeatable) {
                // Whatever the step wrote before is replaced by what it says now
                removeEvent(step);
            } else {
                // Earlier checks stay in the history; marking the same day again corrects that day
                final LocalDate checkDay = date;
                if (step.getEventId() != null && eventRepo.findById(step.getEventId())
                        .map(e -> checkDay.equals(e.getEventDate())).orElse(false)) removeEvent(step);
                step.setEventId(null);
            }
            step.setStatus(next);
            List<String> said = new ArrayList<>();
            if (!OnboardingStep.PENDING.equals(next) && answers != null) {
                for (String a : answers) if (a != null && !a.isBlank()) said.add(a.trim());
            }
            if (!OnboardingStep.PENDING.equals(next) && notes != null && !notes.isBlank()) said.add(notes.trim());
            step.setNotes(said.isEmpty() ? null : String.join(", ", said));
            step.setProblems(problemsIn(step, said));
            step.setDoneDate(OnboardingStep.PENDING.equals(next) ? null : date);
            if (OnboardingStep.DONE.equals(next)) writeEvent(o, step, date);
        }

        if (OnboardingProtocol.RELEASE.equals(step.getStepKey())) {
            boolean finished = !OnboardingStep.PENDING.equals(next);
            o.setStatus(finished ? AnimalOnboarding.COMPLETED : AnimalOnboarding.ACTIVE);
            o.setCompletedDate(finished ? date : null);
        }

        AnimalOnboarding saved = onboardingRepo.save(o);
        if (logId != null && countDue() == 0) completeTask(logId);
        decorate(saved, herdRepo.findById(saved.getHerdId()).orElse(null));
        return saved;
    }

    /** Removes an onboarding started by mistake, with the history events it wrote. */
    @Transactional
    public void delete(Long id) {
        onboardingRepo.findById(id).ifPresent(o -> {
            o.getSteps().forEach(this::removeEvent);
            healthChecks(o).forEach(eventRepo::delete);
            if (o.getStartEventId() != null) eventRepo.findById(o.getStartEventId()).ifPresent(eventRepo::delete);
            onboardingRepo.delete(o);
        });
    }

    /** Steps due or overdue today across every animal still settling in. */
    @Transactional
    public long countDue() {
        return list().stream()
                .filter(o -> AnimalOnboarding.ACTIVE.equals(o.getStatus()))
                .mapToLong(o -> o.getDueCount() == null ? 0 : o.getDueCount())
                .sum();
    }

    /** herdId -> {day number, quarantine days} for the animals still settling in. */
    public Map<Long, int[]> activeDays(Collection<Long> herdIds) {
        Map<Long, int[]> result = new HashMap<>();
        if (herdIds == null || herdIds.isEmpty()) return result;
        LocalDate today = today();
        for (Object[] row : onboardingRepo.findActiveSummaryByHerdIdIn(herdIds)) {
            Long herdId = (Long) row[0];
            LocalDate arrival = (LocalDate) row[1];
            int days = row[2] == null ? OnboardingProtocol.DEFAULT_QUARANTINE_DAYS : (Integer) row[2];
            result.put(herdId, new int[]{(int) ChronoUnit.DAYS.between(arrival, today), days});
        }
        return result;
    }

    /* ─── internals ─── */

    /** Active checklists follow the current protocol; saved only when something moved. */
    private void keepCurrent(AnimalOnboarding o, Herd herd) {
        if (herd == null || !AnimalOnboarding.ACTIVE.equals(o.getStatus())) return;
        if (syncWithProtocol(o, herd)) onboardingRepo.save(o);
    }

    /**
     * Brings a checklist in line with OnboardingProtocol: steps it no longer has are dropped,
     * missing ones added, titles, answers and dates updated. Work already recorded stays. Also
     * builds a new checklist from nothing. Returns true when anything changed.
     */
    private boolean syncWithProtocol(AnimalOnboarding o, Herd herd) {
        List<OnboardingProtocol.StepDef> defs = OnboardingProtocol.stepsFor(herd, o.getArrivalDate());
        Map<String, OnboardingProtocol.StepDef> byKey = new HashMap<>();
        defs.forEach(d -> byKey.put(d.key(), d));
        boolean changed = false;

        Iterator<OnboardingStep> it = o.getSteps().iterator();
        while (it.hasNext()) {
            OnboardingStep step = it.next();
            if (!byKey.containsKey(step.getStepKey())) {
                removeEvent(step);
                it.remove();
                changed = true;
            }
        }

        Map<String, OnboardingStep> have = new HashMap<>();
        o.getSteps().forEach(st -> have.put(st.getStepKey(), st));
        int q = o.getQuarantineDays();
        int order = 0;
        for (OnboardingProtocol.StepDef def : defs) {
            OnboardingStep step = have.get(def.key());
            if (step == null) {
                step = new OnboardingStep();
                step.setStepKey(def.key());
                if (OnboardingProtocol.VACCINATION.equals(def.key()) && OnboardingProtocol.tooYoungForVaccine(herd, o.getArrivalDate())) {
                    step.setStatus(OnboardingStep.SKIPPED);
                    step.setDoneDate(o.getArrivalDate());
                }
                o.getSteps().add(step);
                changed = true;
            }
            String choices = def.choices().isEmpty() ? null : String.join("|", def.choices());
            int from = def.fromDay() < 0 ? q : Math.min(def.fromDay(), q);
            int to = def.toDay() < 0 ? q + 2 : Math.max(from, Math.min(def.toDay(), q));
            LocalDate startDate = o.getArrivalDate().plusDays(from);
            LocalDate endDate = o.getArrivalDate().plusDays(to);
            if (!Objects.equals(step.getTitle(), def.title()) || !Objects.equals(step.getChoices(), choices)
                    || !Objects.equals(step.getStepNo(), def.stepNo()) || !Objects.equals(step.getSortOrder(), order)
                    || step.getDetail() != null || step.getFeedSharePct() != null
                    || !startDate.equals(step.getStartDate()) || !endDate.equals(step.getEndDate())) {
                step.setTitle(def.title());
                step.setChoices(choices);
                step.setStepNo(def.stepNo());
                step.setSortOrder(order);
                step.setDetail(null);
                step.setFeedSharePct(null);
                step.setStartDate(startDate);
                step.setEndDate(endDate);
                changed = true;
            }
            order++;
        }
        return changed;
    }

    /** The answers given that the protocol marks as problems ("!"), e.g. "Fever, Loose dung". */
    private static String problemsIn(OnboardingStep step, List<String> said) {
        if (step.getChoices() == null || said.isEmpty()) return null;
        Set<String> problemChoices = new HashSet<>();
        for (String c : step.getChoices().split("\\|")) if (c.startsWith("!")) problemChoices.add(c.substring(1));
        List<String> problems = said.stream().filter(problemChoices::contains).toList();
        return problems.isEmpty() ? null : String.join(", ", problems);
    }

    /** Health checks written by this onboarding's arrival step, newest first. */
    private List<HerdEvent> healthChecks(AnimalOnboarding o) {
        return eventRepo.findByHerdIdOrderByEventDateDesc(o.getHerdId()).stream()
                .filter(e -> OnboardingProtocol.HEALTH_CHECK_EVENT.equals(e.getEventType())
                        && e.getEventDate() != null && !e.getEventDate().isBefore(o.getArrivalDate()))
                .toList();
    }

    /** Undo on the arrival check removes the latest check and shows the one before, if any. */
    private void undoLatestCheck(AnimalOnboarding o, OnboardingStep step) {
        removeEvent(step);
        Optional<HerdEvent> previous = healthChecks(o).stream()
                .max(Comparator.comparing(HerdEvent::getEventDate).thenComparing(HerdEvent::getId));
        if (previous.isPresent()) {
            HerdEvent e = previous.get();
            List<String> said = e.getDetails() == null ? List.of() : Arrays.asList(e.getDetails().split(", "));
            step.setStatus(OnboardingStep.DONE);
            step.setDoneDate(e.getEventDate());
            step.setNotes(e.getDetails());
            step.setProblems(problemsIn(step, said));
            step.setEventId(e.getId());
        } else {
            step.setStatus(OnboardingStep.PENDING);
            step.setDoneDate(null);
            step.setNotes(null);
            step.setProblems(null);
        }
    }

    /** A deworming or vaccination recorded on the animal page or the deworming round after arrival ticks the step. */
    private void syncFromHistory(AnimalOnboarding o) {
        if (!AnimalOnboarding.ACTIVE.equals(o.getStatus())) return;
        List<OnboardingStep> open = o.getSteps().stream()
                .filter(s -> OnboardingStep.PENDING.equals(s.getStatus())
                        && (OnboardingProtocol.DEWORMING.equals(s.getStepKey()) || OnboardingProtocol.VACCINATION.equals(s.getStepKey())))
                .toList();
        if (open.isEmpty()) return;

        List<HerdEvent> events = eventRepo.findByHerdIdOrderByEventDateDesc(o.getHerdId());
        boolean changed = false;
        for (OnboardingStep step : open) {
            boolean deworming = OnboardingProtocol.DEWORMING.equals(step.getStepKey());
            Optional<HerdEvent> match = events.stream()
                    .filter(e -> e.getEventDate() != null && !e.getEventDate().isBefore(o.getArrivalDate()))
                    .filter(e -> deworming ? DewormingSchedule.isDone(e)
                            : OnboardingProtocol.VACCINATION_EVENT.equalsIgnoreCase(e.getEventType()))
                    .reduce((newer, older) -> older); // earliest after arrival
            if (match.isPresent()) {
                step.setStatus(OnboardingStep.DONE);
                step.setDoneDate(match.get().getEventDate());
                step.setNotes(deworming ? "From the deworming record" : "From the vaccination record");
                changed = true;
            }
        }
        if (changed) onboardingRepo.save(o);
    }

    private void writeEvent(AnimalOnboarding o, OnboardingStep step, LocalDate date) {
        String note = step.getNotes();
        HerdEvent event = switch (step.getStepKey()) {
            case OnboardingProtocol.ARRIVAL -> new HerdEvent(o.getHerdId(), date, OnboardingProtocol.HEALTH_CHECK_EVENT,
                    "Health check", note);
            case OnboardingProtocol.VET_CHECK -> new HerdEvent(o.getHerdId(), date, OnboardingProtocol.VET_CHECK_EVENT,
                    "Vet check-up (onboarding)", note);
            case OnboardingProtocol.DEWORMING -> {
                boolean already = eventRepo.findByHerdIdOrderByEventDateDesc(o.getHerdId()).stream()
                        .anyMatch(e -> DewormingSchedule.isDone(e) && date.equals(e.getEventDate()));
                yield already ? null : new HerdEvent(o.getHerdId(), date, DewormingSchedule.DONE_EVENT,
                        "Deworming done", note != null ? "Onboarding - " + note : "Onboarding");
            }
            case OnboardingProtocol.VACCINATION -> new HerdEvent(o.getHerdId(), date, OnboardingProtocol.VACCINATION_EVENT,
                    "Vaccination done (onboarding)", note);
            case OnboardingProtocol.RELEASE -> new HerdEvent(o.getHerdId(), date, OnboardingProtocol.ENDED_EVENT,
                    "Quarantine over - joined the herd", note);
            default -> null;
        };
        if (event != null) step.setEventId(eventRepo.save(event).getId());
    }

    private void removeEvent(OnboardingStep step) {
        if (step.getEventId() == null) return;
        eventRepo.findById(step.getEventId()).ifPresent(eventRepo::delete);
        step.setEventId(null);
    }

    private void decorate(AnimalOnboarding o, Herd herd) {
        if (herd != null) {
            o.setTagNumber(herd.getTagNumber());
            o.setAnimalName(herd.getAnimalName());
            o.setAnimalType(herd.getAnimalType());
            o.setAnimalStatus(herd.getAnimalStatus());
            o.setImageUrl(herd.getImageUrl());
        }
        LocalDate today = today();
        o.setDayNumber((int) ChronoUnit.DAYS.between(o.getArrivalDate(), today));

        int done = 0, due = 0;
        for (OnboardingStep step : o.getSteps()) {
            String state;
            if (OnboardingStep.DONE.equals(step.getStatus())) state = "DONE";
            else if (OnboardingStep.SKIPPED.equals(step.getStatus())) state = "SKIPPED";
            else if (today.isBefore(step.getStartDate())) state = "UPCOMING";
            else if (today.isAfter(step.getEndDate())) state = "OVERDUE";
            else state = "DUE";
            step.setState(state);
            if (!OnboardingStep.PENDING.equals(step.getStatus())) done++;
            else if (!"UPCOMING".equals(state)) due++;
        }
        o.setDoneCount(done);
        o.setTotalCount(o.getSteps().size());
        o.setDueCount(AnimalOnboarding.ACTIVE.equals(o.getStatus()) ? due : 0);
        o.setFeedSharePct(OnboardingProtocol.feedSharePct(o.getDayNumber(), o.getQuarantineDays()));
        o.setCalf(herd != null && OnboardingProtocol.isCalf(herd, o.getArrivalDate()));

        List<String> problems = new ArrayList<>();
        for (OnboardingStep step : o.getSteps()) {
            if (step.getProblems() != null && OnboardingStep.DONE.equals(step.getStatus())) problems.add(step.getProblems());
        }
        o.setProblems(problems.isEmpty() ? null : String.join(", ", problems));
    }

    private Map<Long, Herd> herdsOf(List<AnimalOnboarding> onboardings) {
        Map<Long, Herd> map = new HashMap<>();
        Set<Long> ids = new HashSet<>();
        onboardings.forEach(o -> ids.add(o.getHerdId()));
        for (Herd herd : herdRepo.findAllById(ids)) map.put(herd.getId(), herd);
        return map;
    }

    private void completeTask(Long logId) {
        try {
            if (activityService.getLog(logId).getStatus() == ActivityStatus.COMPLETED) return;
            activityService.updateLogStatus(logId, ActivityStatus.COMPLETED, null,
                    "Completed automatically - no onboarding step is due.", null);
        } catch (Exception ex) {
            logger.warn("Could not auto-complete chore {} after an onboarding update", logId, ex);
        }
    }

    private static int validDays(Integer days) {
        if (days == null) return OnboardingProtocol.DEFAULT_QUARANTINE_DAYS;
        return Math.max(7, Math.min(60, days));
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
