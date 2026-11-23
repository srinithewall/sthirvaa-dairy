package com.dairy.service;

import com.dairy.dto.HerdWeightHistory;
import com.dairy.model.Breed;
import com.dairy.model.Herd;
import com.dairy.model.HerdEvent;
import com.dairy.model.HerdWeightRecord;
import com.dairy.model.MilkRecord;
import com.dairy.repo.BreedRepository;
import com.dairy.repo.HerdEventRepository;
import com.dairy.repo.HerdRepository;
import com.dairy.repo.HerdWeightRecordRepository;
import com.dairy.repo.MilkRecordRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeMap;

/**
 * One animal's weight history (Analytics &amp; Reports). Each reading gets the healthy weight
 * {@link WeightTarget} gives for the animal as it was that day - its age, its body condition
 * score then, whether it had calved and how far pregnant it was - read from the herd's event
 * log, so the target line follows a calf up its growth curve instead of showing today's figure.
 */
@Service
public class HerdWeightHistoryService {

    /** A BCS scored shortly after a weighing (same round, next day's walk) still describes it. */
    static final int BCS_LOOKAHEAD_DAYS = 30;

    @Autowired private HerdWeightRecordRepository weightRepo;
    @Autowired private HerdRepository herdRepo;
    @Autowired private HerdEventRepository eventRepo;
    @Autowired private BreedRepository breedRepo;
    @Autowired private MilkRecordRepository milkRepo;

    public Optional<HerdWeightHistory> getHistory(Long herdId) {
        return getHistory(herdId, LocalDate.now());
    }

    Optional<HerdWeightHistory> getHistory(Long herdId, LocalDate today) {
        Optional<Herd> found = herdRepo.findById(herdId);
        if (found.isEmpty()) return Optional.empty();
        Herd herd = found.get();

        List<HerdWeightRecord> records = new ArrayList<>(weightRepo.findByHerdIdOrderByRecordDateDesc(herdId));
        records.removeIf(r -> r.getRecordDate() == null || r.getWeightKg() == null || r.getWeightKg() <= 0);
        records.sort(Comparator.comparing(HerdWeightRecord::getRecordDate)
                .thenComparing(HerdWeightRecord::getId, Comparator.nullsFirst(Comparator.naturalOrder())));

        List<HerdEvent> events = eventRepo.findByHerdIdOrderByEventDateDesc(herdId);
        Breed breed = resolveBreed(herd.getBreed());

        List<HerdWeightHistory.Reading> readings = new ArrayList<>();
        HerdWeightRecord prev = null;
        for (HerdWeightRecord r : records) {
            readings.add(reading(herd, breed, events, records, r, prev));
            prev = r;
        }

        LocalDate milkFrom = records.isEmpty()
                ? today.minusMonths(11).withDayOfMonth(1)
                : records.get(0).getRecordDate().withDayOfMonth(1);
        List<HerdWeightHistory.MilkMonth> milk = milkByMonth(milkRepo.findByHerdIdAndDateGreaterThanEqual(herdId, milkFrom));

        return Optional.of(new HerdWeightHistory(
                herd.getId(),
                trim(herd.getTagNumber()),
                trim(herd.getAnimalName()),
                herd.getBreed(),
                herd.getAnimalStatus(),
                readings,
                milk));
    }

    private HerdWeightHistory.Reading reading(Herd herd, Breed breed, List<HerdEvent> events,
                                              List<HerdWeightRecord> all, HerdWeightRecord r, HerdWeightRecord prev) {
        LocalDate date = r.getRecordDate();
        double kg = Math.round(r.getWeightKg());

        Double changeKg = null;
        Integer days = null;
        Integer gain = null;
        if (prev != null) {
            double prevKg = Math.round(prev.getWeightKg());
            changeKg = kg - prevKg;
            days = (int) ChronoUnit.DAYS.between(prev.getRecordDate(), date);
            if (days > 0) gain = (int) Math.round((r.getWeightKg() - prev.getWeightKg()) * 1000 / days);
        }

        HerdEvent bcsEvent = r.getBodyConditionScore() == null ? bcsOn(events, date) : null;
        Double bcs = r.getBodyConditionScore() != null ? r.getBodyConditionScore()
                : bcsEvent != null ? bcsEvent.getScore() : null;
        LocalDate bcsDate = r.getBodyConditionScore() != null ? date
                : bcsEvent != null ? bcsEvent.getEventDate() : null;

        int calvings = calvingsOn(events, date);
        int lactations = (herd.getPreviousLactations() != null ? herd.getPreviousLactations() : 0) + calvings;
        String status = statusOn(herd.getAnimalStatus(), events, date, lactations);

        Integer daysPregnant = null;
        BreedingCycle cycle = BreedingCycle.of(events, date);
        if (cycle.pregnant()) daysPregnant = (int) ChronoUnit.DAYS.between(cycle.conception(), date);

        Integer ageMonths = herd.getBirthDate() != null && !herd.getBirthDate().isAfter(date)
                ? (int) ChronoUnit.MONTHS.between(herd.getBirthDate(), date) : null;

        // Her frame comes from the weighing that score was given against, as known then: weighings
        // up to this one, or up to the score when it was given after this weighing.
        WeightTarget.Weighing frame = null;
        if (bcs != null && bcsDate != null) {
            LocalDate knownBy = bcsDate.isAfter(date) ? bcsDate : date;
            List<WeightTarget.Weighing> known = new ArrayList<>();
            for (HerdWeightRecord w : all) {
                if (w.getRecordDate().isAfter(knownBy)) continue;
                WeightTarget.Weighing x = HerdWeightService.weighing(w);
                if (x != null) known.add(x);
            }
            frame = WeightTarget.frameWeighing(known, bcsDate);
        }
        // Once grown she is held to her fixed base minimum (plus the calf that day), as now.
        WeightTarget.Result target = WeightTarget.of(breed, herd.getBirthDate(), status, lactations,
                daysPregnant, kg, bcs, date, frame, herd.getBaseMinWeightKg(), date);

        return new HerdWeightHistory.Reading(
                r.getId(),
                date,
                kg,
                r.getMeasurementMethod() != null ? r.getMeasurementMethod().name() : null,
                r.getHeartGirthCm(),
                bcs,
                bcsDate,
                changeKg,
                days,
                gain,
                target != null ? target.targetKg() : null,
                target != null ? target.targetKg() - kg : null,
                target != null ? target.basis() : null,
                ageMonths,
                daysPregnant,
                r.getNotes());
    }

    /** The latest score on or before the day; failing that, the first one within a month after it. */
    static HerdEvent bcsOn(List<HerdEvent> events, LocalDate date) {
        HerdEvent before = null, after = null;
        for (HerdEvent e : events) {
            if (!HerdService.BCS_EVENT.equals(e.getEventType()) || e.getScore() == null || e.getEventDate() == null) continue;
            LocalDate d = e.getEventDate();
            if (!d.isAfter(date)) {
                if (before == null || d.isAfter(before.getEventDate())) before = e;
            } else if (!d.isAfter(date.plusDays(BCS_LOOKAHEAD_DAYS))) {
                if (after == null || d.isBefore(after.getEventDate())) after = e;
            }
        }
        return before != null ? before : after;
    }

    /** Calvings recorded on or before the day; two entered for the same day count once. */
    static int calvingsOn(List<HerdEvent> events, LocalDate date) {
        Set<LocalDate> days = new HashSet<>();
        for (HerdEvent e : events) {
            if (e.getEventDate() == null || e.getEventType() == null || e.getEventDate().isAfter(date)) continue;
            if (BreedingCycle.CALVING_TYPES.contains(e.getEventType().toUpperCase())) days.add(e.getEventDate());
        }
        return days.size();
    }

    /**
     * What the animal was on the day, as far as {@link WeightTarget} cares: calved or not. A cow
     * whose first calving is recorded after the day was a heifer then. A cow with no calving or
     * lactation on record at all (bought in milk) keeps her current status - nothing says otherwise.
     */
    static String statusOn(String currentStatus, List<HerdEvent> events, LocalDate date, int lactationsOn) {
        String current = currentStatus == null ? "" : currentStatus.trim().toUpperCase();
        if (lactationsOn > 0) return "LACTATING";
        boolean anyStart = false, startedByThen = false;
        for (HerdEvent e : events) {
            if (e.getEventDate() == null || e.getEventType() == null) continue;
            String type = e.getEventType().toUpperCase();
            if (BreedingCycle.CALVING_TYPES.contains(type) || "LACTATION_STARTED".equals(type)) {
                anyStart = true;
                if (!e.getEventDate().isAfter(date)) startedByThen = true;
            }
        }
        if (startedByThen) return "LACTATING";
        if (!anyStart) return currentStatus;
        return "CALF".equals(current) ? "CALF" : "HEIFER";
    }

    static List<HerdWeightHistory.MilkMonth> milkByMonth(List<MilkRecord> records) {
        Map<YearMonth, Map<LocalDate, Double>> byMonth = new TreeMap<>();
        for (MilkRecord m : records) {
            if (m.getDate() == null || m.getQuantity() == null) continue;
            byMonth.computeIfAbsent(YearMonth.from(m.getDate()), k -> new TreeMap<>())
                    .merge(m.getDate(), m.getQuantity(), Double::sum);
        }
        List<HerdWeightHistory.MilkMonth> out = new ArrayList<>();
        byMonth.forEach((month, days) -> {
            double total = days.values().stream().mapToDouble(Double::doubleValue).sum();
            int n = days.size();
            out.add(new HerdWeightHistory.MilkMonth(month.atDay(1), (double) Math.round(total), n,
                    n > 0 ? Math.round(total / n * 10) / 10.0 : null));
        });
        return out;
    }

    private Breed resolveBreed(String name) {
        String key = name != null && !name.isBlank() ? name.trim().toLowerCase() : "unknown";
        Breed unknown = null;
        for (Breed b : breedRepo.findAll()) {
            if (b.getName() == null) continue;
            String n = b.getName().trim().toLowerCase();
            if (n.equals(key)) return b;
            if (n.equals("unknown")) unknown = b;
        }
        return unknown;
    }

    private static String trim(String s) {
        return s != null ? s.trim() : null;
    }
}
