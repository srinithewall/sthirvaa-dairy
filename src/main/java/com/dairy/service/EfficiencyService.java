package com.dairy.service;

import com.dairy.model.AmcsCollection;
import com.dairy.model.Breed;
import com.dairy.model.Herd;
import com.dairy.model.HerdEvent;
import com.dairy.model.MilkRecord;
import com.dairy.repo.AmcsCollectionRepository;
import com.dairy.repo.BreedRepository;
import com.dairy.repo.HerdEventRepository;
import com.dairy.repo.MilkRecordRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Efficiency report, one row per cow that has calved (or is in milk), in three parts:
 *
 *   - Reproduction: the golden rule is one calf a year, i.e. a 365-day calving interval, which needs
 *     the cow pregnant again within 85 days of calving (85 + 280 days of pregnancy). Calving
 *     efficiency = 365 / interval, so it is 100% on the rule and drops gradually the longer she
 *     takes. A cow not yet pregnant past day 85 is scored on the interval she can best reach now
 *     (days since calving + 280). Milk lost to late calving is the share of a lactation a year she
 *     misses: lactation yield x (1 - 365 / interval).
 *   - Milk target: last-30-day average against the cow's milk potential (litres a day). Dry cows
 *     are left out.
 *   - Lactation: milk recorded since the last calving against target x days recorded, and a
 *     projected 305-day total (recorded milk, unrecorded days at the recorded average, remaining days
 *     at the 30-day average) against the 305-day estimate (target x 305).
 *
 * Milk is priced at the AMCS society rate over the last 90 days (amount / litres), or a default
 * when there are no collections.
 */
@Service
public class EfficiencyService {

    static final int TARGET_DAYS_OPEN = 85;
    static final int GESTATION_DAYS = 280;
    static final int CALVING_INTERVAL = 365;
    static final int LACTATION_DAYS = 305;
    static final double DEFAULT_MILK_RATE = 35.0;
    static final int HEAT_CYCLE_DAYS = 21;
    static final int DRY_PERIOD_DAYS = 60;
    static final double DAYS_PER_MONTH = 30.44;

    private static final Set<String> MILKING_TYPES = Set.of("COW", "BUFFALO");

    @Autowired
    private HerdService herdService;

    @Autowired
    private HerdEventRepository eventRepository;

    @Autowired
    private BreedRepository breedRepository;

    @Autowired
    private MilkRecordRepository milkRecordRepository;

    @Autowired
    private com.dairy.repo.HerdRepository herdRepository;

    /**
     * Stores a cow's milk potential from the target the farm sets for today: today's figure divided by
     * where she is on her lactation curve and her pregnancy, so it keeps moving with both. Null clears it.
     */
    public boolean setTarget(Long herdId, Double todayLitres) {
        Optional<Herd> found = herdRepository.findById(herdId);
        if (found.isEmpty()) return false;
        if (todayLitres == null) {
            herdRepository.setMilkPotential(herdId, null);
            return true;
        }
        LocalDate today = LocalDate.now();
        BreedingCycle cycle = BreedingCycle.of(eventRepository.findByHerdIdOrderByEventDateDesc(herdId), today);
        Integer dim = cycle.lastCalving() != null ? (int) ChronoUnit.DAYS.between(cycle.lastCalving(), today) : null;
        Integer daysPregnant = cycle.pregnant() ? (int) ChronoUnit.DAYS.between(cycle.conception(), today) : null;
        herdRepository.setMilkPotential(herdId, Math.round(potentialFor(todayLitres, dim, daysPregnant) * 10) / 10.0);
        return true;
    }

    /** The lactation-average potential that gives this target today. */
    static double potentialFor(double todayLitres, Integer dim, Integer daysPregnant) {
        return todayLitres / (curve(dim) * pregnancy(daysPregnant));
    }

    @Autowired
    private AmcsCollectionRepository amcsRepository;

    public Map<String, Object> report() {
        LocalDate today = LocalDate.now();

        List<Herd> herds = herdService.getAllHerds().stream()
                .filter(h -> "ACTIVE".equals(h.getStatus()))
                .filter(h -> h.getAnimalType() != null && MILKING_TYPES.contains(h.getAnimalType().toUpperCase()))
                .toList();
        List<Long> ids = herds.stream().map(Herd::getId).toList();

        Map<Long, List<HerdEvent>> eventsByHerd = new HashMap<>();
        Map<Long, TreeMap<LocalDate, Double>> dailyByHerd = new HashMap<>();
        if (!ids.isEmpty()) {
            for (HerdEvent e : eventRepository.findByHerdIdInOrderByEventDateDesc(ids)) {
                eventsByHerd.computeIfAbsent(e.getHerdId(), k -> new ArrayList<>()).add(e);
            }
            for (Object[] row : milkRecordRepository.sumDailyByHerdIdsSince(ids, LocalDate.of(2000, 1, 1))) {
                // Complete days only: today is usually half entered (or not yet), so every figure
                // below - averages, lactation totals, projections - runs to yesterday.
                if (!((LocalDate) row[1]).isBefore(today)) continue;
                double litres = row[2] != null ? ((Number) row[2]).doubleValue() : 0.0;
                dailyByHerd.computeIfAbsent((Long) row[0], k -> new TreeMap<>()).merge((LocalDate) row[1], litres, Double::sum);
            }
        }

        Double amcsRate = amcsMilkRate(today);
        Map<String, Breed> breeds = new HashMap<>();
        for (Breed b : breedRepository.findAll()) {
            if (b.getName() != null) breeds.put(b.getName().trim().toLowerCase(), b);
        }
        // The farm's own breeding record: how long cows take to conceive and how long they stay dry.
        FarmCycle farm = farmCycle(herds, eventsByHerd, dailyByHerd, today);
        List<Map<String, Object>> cows = new ArrayList<>();
        for (Herd h : herds) {
            List<HerdEvent> events = eventsByHerd.getOrDefault(h.getId(), List.of());
            BreedingCycle cycle = BreedingCycle.of(events, today);
            boolean inMilkOrDry = "LACTATING".equals(h.getAnimalStatus()) || "DRY".equals(h.getAnimalStatus());
            if (cycle.lastCalving() == null && !inMilkOrDry) continue; // calves and heifers
            cows.add(cowRow(h, events, cycle, dailyByHerd.getOrDefault(h.getId(), new TreeMap<>()), today, breeds, farm));
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("asOf", today);
        out.put("milkRate", round(amcsRate != null ? amcsRate : DEFAULT_MILK_RATE, 2));
        out.put("milkRateSource", amcsRate != null ? "AMCS" : "DEFAULT");
        out.put("rules", Map.of("targetDaysOpen", TARGET_DAYS_OPEN, "gestationDays", GESTATION_DAYS,
                "calvingInterval", CALVING_INTERVAL, "lactationDays", LACTATION_DAYS,
                "farmDaysOpen", farm.daysOpen(), "farmDryDays", farm.dryDays(),
                "farmCycleDays", farm.daysOpen() + GESTATION_DAYS));
        out.put("milkPerDay", milkPerDay(today));
        out.put("cows", cows);
        return out;
    }

    private Map<String, Object> cowRow(Herd h, List<HerdEvent> events, BreedingCycle cycle,
                                       TreeMap<LocalDate, Double> daily, LocalDate today, Map<String, Breed> breeds,
                                       FarmCycle farm) {
        boolean dry = "DRY".equals(h.getAnimalStatus());
        LocalDate calving = cycle.lastCalving();
        Integer dim = calving != null ? (int) ChronoUnit.DAYS.between(calving, today) : null;
        double avg30 = h.getAvgMilk30Days() != null ? h.getAvgMilk30Days() : 0.0;
        // Her potential kept healthy - set by the farm, else breed/age/lactation; today's target follows
        // her lactation curve and pregnancy.
        boolean targetSet = h.getMilkPotentialSet() != null && h.getMilkPotentialSet() > 0;
        Double target = targetSet ? h.getMilkPotentialSet()
                : h.getMilkPotential() != null && h.getMilkPotential() > 0 ? Double.valueOf(h.getMilkPotential()) : null;

        SortedMap<LocalDate, Double> current = calving != null ? daily.tailMap(calving) : daily;
        int recordedDays = current.size();
        double recordedLitres = current.values().stream().mapToDouble(Double::doubleValue).sum();
        double recordedAvg = recordedDays > 0 ? recordedLitres / recordedDays : 0.0;

        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", h.getId());
        row.put("name", h.getAnimalName() != null ? h.getAnimalName().trim() : h.getTagNumber());
        row.put("tagNumber", h.getTagNumber());
        row.put("breed", h.getBreed());
        row.put("animalStatus", h.getAnimalStatus());
        row.put("imageUrl", h.getImageUrl());
        row.put("lastCalving", calving);
        row.put("dim", dim);
        row.put("lactationNumber", h.getLactationNumber() != null ? h.getLactationNumber() : 0);
        Map<String, Object> repro = reproduction(cycle, dim, recordedAvg > 0 ? recordedAvg : avg30, dry, events, current, today);
        Map<String, Object> lact = calving == null ? null
                : lactation(calving, dim, dry, target, avg30, current, recordedDays, recordedLitres, recordedAvg);
        row.put("reproduction", repro);
        Map<String, Object> mt = dry || target == null ? null
                : milkTarget(lastDays(daily, today.minusDays(1), AVG_DAYS), target, dim, h.getPregnancyDaysPregnant());
        if (mt != null) mt.put("targetSet", targetSet);
        row.put("milkTarget", mt);
        if (lact != null) lact.put("possible", possible(h, breeds, ((Number) lact.get("projected")).doubleValue()));
        row.put("lactation", lact);
        // Her own interval once she is bred; until then, as long as cows on this farm take to conceive.
        int interval = repro.get("calvingInterval") != null ? (Integer) repro.get("calvingInterval")
                : Math.max(dim != null ? dim : 0, farm.daysOpen()) + GESTATION_DAYS;
        row.put("cycleAverage", lact == null ? null
                : cycleAverage(events, daily, today, ((Number) lact.get("projected")).doubleValue(), interval,
                        dry, farm.dryDays()));
        row.put("history", history(events, daily, today, h.getPreviousLactations() != null ? h.getPreviousLactations() : 0));
        row.put("flags", flags(events, cycle, today));
        // Today's target, as on the Milk target tab: her set potential carried along her lactation curve.
        row.put("yieldCheck", mt == null ? null : yieldCheck(daily, ((Number) mt.get("targetPerDay")).doubleValue(), today));
        return row;
    }

    /**
     * Breeding state, the calving interval it leads to (in days and months), the expected next
     * calving, and the dry-off date 60 days before it. A cow found not pregnant gets her next AI one
     * heat cycle (21 days) after the negative PD, and her interval is projected from that AI.
     */
    private Map<String, Object> reproduction(BreedingCycle cycle, Integer dim, double dailyYield, boolean dry,
                                             List<HerdEvent> events, SortedMap<LocalDate, Double> lactationDays,
                                             LocalDate today) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("inseminations", cycle.inseminations());
        r.put("aiDate", cycle.conception());
        r.put("pdDate", cycle.pdDate());
        if (dim == null) {
            r.put("state", "NO_CALVING");
            return r;
        }
        LocalDate calving = cycle.lastCalving();
        Integer daysOpen = null, interval = null;
        String state;
        if (cycle.pregnant()) {
            daysOpen = (int) ChronoUnit.DAYS.between(calving, cycle.conception());
            interval = daysOpen + GESTATION_DAYS;
            state = cycle.confirmed() ? "CONFIRMED" : "INSEMINATED";
        } else if (cycle.notPregnantOn() != null) {
            // Found open: try again at the next heat, one cycle after the negative PD.
            LocalDate nextAi = cycle.notPregnantOn().plusDays(HEAT_CYCLE_DAYS);
            r.put("notPregnantOn", cycle.notPregnantOn());
            r.put("nextAiDue", nextAi);
            LocalDate plannedAi = nextAi.isBefore(today) ? today : nextAi;
            daysOpen = (int) ChronoUnit.DAYS.between(calving, plannedAi);
            interval = daysOpen + GESTATION_DAYS;
            state = "OPEN";
        } else if (dim <= TARGET_DAYS_OPEN) {
            state = "WAITING";
            r.put("daysLeft", TARGET_DAYS_OPEN - dim);
            r.put("breedBy", calving.plusDays(TARGET_DAYS_OPEN));
        } else {
            // Not inseminated past day 85: the best interval she can still reach, growing every day.
            daysOpen = dim;
            interval = dim + GESTATION_DAYS;
            state = "OPEN";
        }
        r.put("state", state);
        r.put("daysOpen", daysOpen);
        r.put("calvingInterval", interval);
        if (interval != null) {
            LocalDate nextCalving = calving.plusDays(interval);
            r.put("monthsToNextCalf", round(interval / DAYS_PER_MONTH, 1));
            r.put("expectedCalving", nextCalving);
            r.put("efficiency", round(Math.min(100.0, 100.0 * CALVING_INTERVAL / interval), 1));
            double lost = interval > CALVING_INTERVAL ? dailyYield * LACTATION_DAYS * (1 - (double) CALVING_INTERVAL / interval) : 0.0;
            r.put("milkLostPerYear", round(lost, 0));
            r.put("calvesMissedPerYear", round(Math.max(0, 1 - (double) CALVING_INTERVAL / interval), 3));
            if (cycle.pregnant()) dryPeriod(r, dry, nextCalving, calving, events, lactationDays, today);
        }
        return r;
    }

    /**
     * Dry-off is planned {@value #DRY_PERIOD_DAYS} days before the expected calving. A cow already dry
     * dates her dry period from the DRY_PERIOD_STARTED event, else the day after her last milk record.
     */
    private void dryPeriod(Map<String, Object> r, boolean dry, LocalDate nextCalving, LocalDate calving,
                           List<HerdEvent> events, SortedMap<LocalDate, Double> lactationDays, LocalDate today) {
        LocalDate dryOff = nextCalving.minusDays(DRY_PERIOD_DAYS);
        r.put("dryOffDate", dryOff);
        r.put("dryOffInDays", (int) ChronoUnit.DAYS.between(today, dryOff));
        if (!dry) return;
        LocalDate drySince = events.stream()
                .filter(e -> "DRY_PERIOD_STARTED".equalsIgnoreCase(e.getEventType()) && e.getEventDate() != null
                        && e.getEventDate().isAfter(calving) && !e.getEventDate().isAfter(today))
                .map(HerdEvent::getEventDate).max(LocalDate::compareTo)
                .orElse(lactationDays.isEmpty() ? null : lactationDays.lastKey().plusDays(1));
        if (drySince != null) {
            r.put("drySince", drySince);
            r.put("dryPeriodDays", (int) ChronoUnit.DAYS.between(drySince, nextCalving));
        }
    }

    /** How long cows on this farm take to conceive after calving, and how long they stay dry. */
    record FarmCycle(int daysOpen, int dryDays, int daysOpenCows, int dryCycles) {}

    /**
     * The farm's own averages. Days open: completed calving intervals less gestation, pregnant cows'
     * days from calving to the AI that held, and cows still open past the target - counted at their
     * days so far, as they are at least that late. Dry days: each completed cycle's dry-off (the dry
     * event, else the day after its last milk record) to the next calving. Without records, the
     * targets ({@value #TARGET_DAYS_OPEN} days open, {@value #DRY_PERIOD_DAYS} dry days) stand in.
     */
    static FarmCycle farmCycle(List<Herd> herds, Map<Long, List<HerdEvent>> eventsByHerd,
                               Map<Long, TreeMap<LocalDate, Double>> dailyByHerd, LocalDate today) {
        List<Integer> open = new ArrayList<>();
        List<Integer> dryDays = new ArrayList<>();
        for (Herd h : herds) {
            List<HerdEvent> events = eventsByHerd.getOrDefault(h.getId(), List.of());
            TreeMap<LocalDate, Double> daily = dailyByHerd.getOrDefault(h.getId(), new TreeMap<>());
            TreeSet<LocalDate> calvings = calvingDates(events, today);
            for (LocalDate from : calvings) {
                LocalDate next = calvings.higher(from);
                if (next == null) break;
                int interval = (int) ChronoUnit.DAYS.between(from, next);
                if (interval >= 300 && interval <= 800) open.add(interval - GESTATION_DAYS);
                LocalDate dryStart = events.stream()
                        .filter(e -> "DRY_PERIOD_STARTED".equalsIgnoreCase(e.getEventType()) && e.getEventDate() != null
                                && e.getEventDate().isAfter(from) && e.getEventDate().isBefore(next))
                        .map(HerdEvent::getEventDate).max(LocalDate::compareTo)
                        .orElseGet(() -> {
                            SortedMap<LocalDate, Double> part = daily.subMap(from, next);
                            return part.isEmpty() ? null : part.lastKey().plusDays(1);
                        });
                if (dryStart != null) {
                    int d = (int) ChronoUnit.DAYS.between(dryStart, next);
                    if (d >= 15 && d <= 200) dryDays.add(d);
                }
            }
            BreedingCycle cycle = BreedingCycle.of(events, today);
            LocalDate calving = cycle.lastCalving();
            if (calving != null) {
                if (cycle.pregnant() && cycle.conception().isAfter(calving)) {
                    open.add((int) ChronoUnit.DAYS.between(calving, cycle.conception()));
                } else if (!cycle.pregnant()) {
                    int dim = (int) ChronoUnit.DAYS.between(calving, today);
                    if (dim > TARGET_DAYS_OPEN) open.add(dim);
                }
            }
        }
        int daysOpen = open.isEmpty() ? TARGET_DAYS_OPEN
                : (int) Math.round(open.stream().mapToInt(Integer::intValue).average().orElse(TARGET_DAYS_OPEN));
        int dry = dryDays.isEmpty() ? DRY_PERIOD_DAYS
                : (int) Math.round(dryDays.stream().mapToInt(Integer::intValue).average().orElse(DRY_PERIOD_DAYS));
        return new FarmCycle(Math.max(daysOpen, 45), dry, open.size(), dryDays.size());
    }

    /**
     * Milk a day over whole calving cycles, dry days included: every completed cycle with milk
     * recorded from calving (within 10 days), plus the current one projected (305-day yield over its
     * calving interval). Cycles recorded only in part are left out rather than understating the cow.
     */
    private Map<String, Object> cycleAverage(List<HerdEvent> events, TreeMap<LocalDate, Double> daily, LocalDate today,
                                             double projectedLitres, int currentInterval, boolean dry, int dryDays) {
        TreeSet<LocalDate> calvings = calvingDates(events, today);
        // A cow still milking is milked until the farm's usual dry period before her next calving:
        // a long interval means more (lower-yield) days at the end, not a fixed 305.
        double litres = dry ? projectedLitres
                : projectedLitres * shapeSum(1, Math.max(1, currentInterval - dryDays)) / shapeSum(1, LACTATION_DAYS);
        long days = currentInterval;
        int complete = 0;
        for (LocalDate from : calvings) {
            LocalDate next = calvings.higher(from);
            if (next == null) break;
            SortedMap<LocalDate, Double> part = daily.subMap(from, next);
            if (part.isEmpty() || part.firstKey().isAfter(from.plusDays(10))) continue;
            litres += part.values().stream().mapToDouble(Double::doubleValue).sum();
            days += ChronoUnit.DAYS.between(from, next);
            complete++;
        }
        Map<String, Object> c = new LinkedHashMap<>();
        c.put("perDay", round(days > 0 ? litres / days : 0, 2));
        c.put("completedCycles", complete);
        return c;
    }

    private static TreeSet<LocalDate> calvingDates(List<HerdEvent> events, LocalDate today) {
        TreeSet<LocalDate> calvings = new TreeSet<>();
        for (HerdEvent e : events) {
            if (e.getEventDate() != null && !e.getEventDate().isAfter(today) && e.getEventType() != null
                    && BreedingCycle.CALVING_TYPES.contains(e.getEventType().toUpperCase())) {
                calvings.add(e.getEventDate());
            }
        }
        return calvings;
    }

    /** Day of lactation the curve peaks on (Wood's curve, b/c). */
    static final int PEAK_DIM = 50;

    /** "Avg / day" on the milk target is her last week, so it shows how she is doing now. */
    static final int AVG_DAYS = 7;

    /**
     * Her daily potential on this day of lactation, as a multiple of her lactation average, along the
     * standard lactation curve: below 1 in the first days, about 1.26 at the peak (day 50), below 1
     * late in lactation. Averages 1 over 305 days.
     */
    static double curve(Integer dim) {
        if (dim == null) return 1.0;
        return AssetValuationService.lactationShapeUncapped(Math.max(1, dim));
    }

    /** Pregnancy starts to cut milk around this day of gestation... */
    static final int PREGNANCY_EFFECT_FROM = 120;
    /** ...and takes about this share off by this day (a cow is usually dried off soon after). */
    static final int PREGNANCY_EFFECT_FULL = 240;
    static final double PREGNANCY_EFFECT_MAX = 0.15;

    /**
     * Share of her yield left as pregnancy advances: none taken until about 4 months, then rising
     * steadily to about 15% by 8 months, as the calf draws on her.
     */
    static double pregnancy(Integer daysPregnant) {
        if (daysPregnant == null || daysPregnant <= PREGNANCY_EFFECT_FROM) return 1.0;
        double t = Math.min(1.0, (daysPregnant - PREGNANCY_EFFECT_FROM) / (double) (PREGNANCY_EFFECT_FULL - PREGNANCY_EFFECT_FROM));
        return 1.0 - PREGNANCY_EFFECT_MAX * t;
    }

    /** Average litres a day over the days recorded in the last {@code days} days up to today; 0 with none. */
    static double lastDays(SortedMap<LocalDate, Double> daily, LocalDate today, int days) {
        SortedMap<LocalDate, Double> week = daily.subMap(today.minusDays(days - 1L), today.plusDays(1));
        return week.isEmpty() ? 0.0 : week.values().stream().mapToDouble(Double::doubleValue).sum() / week.size();
    }

    /**
     * Today's target: her potential kept healthy (breed, age, lactation - a lactation-average daily
     * figure) carried along the lactation curve to her days in milk. What she gives below it is milk
     * that keeping her healthy can gain.
     */
    static Map<String, Object> milkTarget(double avg, double potential, Integer dim, Integer daysPregnant) {
        double today = potential * curve(dim) * pregnancy(daysPregnant);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("avgPerDay", round(avg, 2));
        m.put("avgDays", AVG_DAYS);
        m.put("peakPerDay", round(potential * curve(PEAK_DIM), 1));
        m.put("targetPerDay", round(today, 1));
        m.put("efficiency", round(100.0 * avg / today, 1));
        m.put("lostPerDay", round(Math.max(0, today - avg), 2));
        return m;
    }

    private Map<String, Object> lactation(LocalDate calving, int dim, boolean dry, Double target, double avg30,
                                          SortedMap<LocalDate, Double> current, int recordedDays,
                                          double recordedLitres, double recordedAvg) {
        Map<String, Object> l = new LinkedHashMap<>();
        l.put("from", calving);
        l.put("ended", dry);
        l.put("recordedDays", recordedDays);
        l.put("recordedLitres", round(recordedLitres, 1));
        l.put("firstRecord", current.isEmpty() ? null : current.firstKey());

        int span = dry && !current.isEmpty()
                ? (int) ChronoUnit.DAYS.between(calving, current.lastKey()) + 1
                : dim;
        int expectedDays = Math.min(span, LACTATION_DAYS);
        l.put("partlyRecorded", expectedDays - Math.min(recordedDays, expectedDays) > 7);

        l.put("projected", round(projected305(calving, dim, dry, span, avg30, current, recordedLitres, recordedAvg), 0));
        double projected = ((Number) l.get("projected")).doubleValue();

        if (target != null) {
            // Her potential carried along the lactation curve, day by day.
            double recordedTarget = 0;
            for (LocalDate d : current.keySet()) {
                recordedTarget += target * curve((int) ChronoUnit.DAYS.between(calving, d) + 1);
            }
            double estimate = target * shapeSum(1, LACTATION_DAYS);
            l.put("recordedTarget", round(recordedTarget, 0));
            l.put("achieved", recordedTarget > 0 ? round(100.0 * recordedLitres / recordedTarget, 1) : null);
            l.put("estimate", round(estimate, 0));
            l.put("projectedPct", round(100.0 * projected / estimate, 1));
        }
        return l;
    }

    /**
     * Milk a cow should give by day 305, along the standard lactation curve (the one cow values use):
     * yield rises to a peak around day 50 and tapers off, so a cow near her peak is not assumed to
     * hold that yield to the end. Days before her records start are filled from the curve at her
     * recorded level; the days left come from her last 30 days, carried along the curve. A lactation
     * that has ended is scaled from what was recorded to a full 305 days (or as long as it ran).
     */
    private double projected305(LocalDate calving, int dim, boolean dry, int span, double avg30,
                                SortedMap<LocalDate, Double> current, double recordedLitres, double recordedAvg) {
        if (current.isEmpty()) return avg30 * Math.max(0, LACTATION_DAYS - dim);
        int firstDim = (int) ChronoUnit.DAYS.between(calving, current.firstKey()) + 1;
        // Litres per unit of curve, from the days actually recorded this lactation.
        double recordedShape = 0;
        for (LocalDate d : current.keySet()) {
            recordedShape += AssetValuationService.lactationShapeUncapped((int) ChronoUnit.DAYS.between(calving, d) + 1);
        }
        double level = recordedShape > 0 ? recordedLitres / recordedShape : recordedAvg;

        if (dry || dim >= LACTATION_DAYS) {
            return level * shapeSum(1, Math.min(span, LACTATION_DAYS));
        }
        double gap = firstDim > 1 ? level * shapeSum(1, firstDim - 1) : 0;
        // The days left follow her recent level: last 30 days' average over the curve for those days.
        int from30 = Math.max(1, dim - 29);
        double recentShape = shapeSum(from30, dim);
        double recentLevel = avg30 > 0 && recentShape > 0 ? avg30 * (dim - from30 + 1) / recentShape : level;
        return recordedLitres + gap + recentLevel * shapeSum(dim + 1, LACTATION_DAYS);
    }

    private static double shapeSum(int fromDim, int toDim) {
        double s = 0;
        for (int d = Math.max(1, fromDim); d <= toDim; d++) s += AssetValuationService.lactationShapeUncapped(d);
        return s;
    }

    /**
     * What a well-kept cow of her breed and lactation can give in 305 days: the breed's normal daily
     * milk (set per breed on the inventory page, else the built-in estimate) x 305, adjusted for
     * lactation - first-calvers give less, cows peak in their 3rd to 5th lactation and ease off later.
     */
    private Map<String, Object> possible(Herd h, Map<String, Breed> breeds, double projected) {
        Breed breed = h.getBreed() != null ? breeds.get(h.getBreed().trim().toLowerCase()) : null;
        double perDay = breed != null && breed.getNormalYield() != null && breed.getNormalYield() > 0
                ? breed.getNormalYield() : AssetValuationService.defaultPrice(h)[1];
        int lactation = h.getLactationNumber() != null ? h.getLactationNumber() : 0;
        double factor = lactation == 1 ? 0.85 : lactation == 2 ? 0.95 : lactation >= 6 ? 0.92 : 1.0;
        if (lactation == 0 && h.getBirthDate() != null
                && java.time.Period.between(h.getBirthDate(), LocalDate.now()).getYears() < 3) factor = 0.85;
        double litres = perDay * LACTATION_DAYS * factor;
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("litres", round(litres, 0));
        p.put("normalPerDay", round(perDay, 1));
        p.put("factor", factor);
        p.put("efficiency", litres > 0 ? round(100.0 * projected / litres, 1) : null);
        return p;
    }

    /**
     * Every lactation from the recorded calvings, oldest first, with the milk recorded in each;
     * numbered after the ones before her records ({@code previous}).
     */
    private List<Map<String, Object>> history(List<HerdEvent> events, TreeMap<LocalDate, Double> daily, LocalDate today,
                                              int previous) {
        TreeSet<LocalDate> calvings = calvingDates(events, today);
        List<Map<String, Object>> out = new ArrayList<>();
        int n = previous;
        for (LocalDate from : calvings) {
            LocalDate next = calvings.higher(from);
            SortedMap<LocalDate, Double> part = next != null ? daily.subMap(from, next) : daily.tailMap(from);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("number", ++n);
            m.put("from", from);
            m.put("to", next != null ? next.minusDays(1) : null);
            m.put("recordedDays", part.size());
            m.put("litres", round(part.values().stream().mapToDouble(Double::doubleValue).sum(), 1));
            out.add(m);
        }
        return out;
    }

    /** Record problems that skew the figures, worded for the farm. */
    private List<String> flags(List<HerdEvent> events, BreedingCycle cycle, LocalDate today) {
        List<String> out = new ArrayList<>();
        Map<LocalDate, Integer> calvingsByDate = new TreeMap<>();
        for (HerdEvent e : events) {
            if (e.getEventType() != null && BreedingCycle.CALVING_TYPES.contains(e.getEventType().toUpperCase())) {
                calvingsByDate.merge(e.getEventDate(), 1, Integer::sum);
            }
        }
        calvingsByDate.forEach((d, c) -> {
            if (c > 1) out.add("Calving on " + d + " is entered " + c + " times");
        });
        if (cycle.confirmed() && cycle.conception().equals(cycle.pdDate())) {
            out.add("Pregnancy confirmed on " + cycle.pdDate() + " with no insemination recorded; counted from the PD date");
        }
        if (cycle.pregnant() && ChronoUnit.DAYS.between(cycle.conception(), today) > GESTATION_DAYS + 15) {
            out.add("Over " + (GESTATION_DAYS + 15) + " days since the insemination; record the calving or a new insemination");
        }
        return out;
    }

    /**
     * A cow giving well under today's target (her lactation-curve target, the one the Milk target tab
     * shows): her last 7 days against it, and the change from the 7 days two weeks earlier, so a
     * cow climbing back reads as recovering. Read
     * fresh from the milk records every time; old lows before the farm knew her do not count.
     * Null when she is near target or has no recent records.
     */
    static Map<String, Object> yieldCheck(TreeMap<LocalDate, Double> daily, Double target, LocalDate today) {
        if (target == null || target <= 0) return null;
        // Complete days only: the window ends yesterday.
        LocalDate end = today.minusDays(1);
        int recentDays = daily.subMap(end.minusDays(AVG_DAYS - 1L), end.plusDays(1)).size();
        if (recentDays < 3) return null;
        double last7 = lastDays(daily, end, AVG_DAYS);
        if (last7 >= 0.7 * target) return null;
        double before = lastDays(daily, end.minusDays(14), AVG_DAYS);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("last7", round(last7, 1));
        m.put("before", before > 0 ? round(before, 1) : null);
        m.put("change", before > 0 ? round(last7 - before, 1) : null);
        m.put("target", round(target, 1));
        m.put("pct", round(100.0 * last7 / target, 0));
        m.put("rising", before > 0 && last7 - before >= 0.5);
        return m;
    }

    private Map<String, Object> milkPerDay(LocalDate today) {
        Map<LocalDate, Double> totals = new TreeMap<>();
        for (MilkRecord r : milkRecordRepository.findByDateBetween(today.minusDays(7), today)) {
            if (r.getQuantity() != null) totals.merge(r.getDate(), r.getQuantity(), Double::sum);
        }
        Map<String, Object> m = new LinkedHashMap<>();
        // Last 7 complete days; today is still being recorded.
        List<Double> week = totals.entrySet().stream().filter(e -> e.getKey().isBefore(today)).map(Map.Entry::getValue).toList();
        m.put("last7Avg", week.isEmpty() ? null : round(week.stream().mapToDouble(Double::doubleValue).average().orElse(0), 1));
        m.put("days", week.size());
        Map.Entry<LocalDate, Double> latest = ((TreeMap<LocalDate, Double>) totals).lastEntry();
        m.put("latestDate", latest != null ? latest.getKey() : null);
        m.put("latestTotal", latest != null ? round(latest.getValue(), 1) : null);
        return m;
    }

    /** Rupees a litre the society paid over the last 90 days, or null when there were no collections. */
    private Double amcsMilkRate(LocalDate today) {
        double amount = 0, litres = 0;
        for (AmcsCollection c : amcsRepository.findByDateBetweenOrderByDateDescShiftAsc(today.minusDays(90), today)) {
            if (c.getAmount() != null && c.getQuantity() != null && c.getQuantity() > 0) {
                amount += c.getAmount();
                litres += c.getQuantity();
            }
        }
        return litres > 0 ? amount / litres : null;
    }

    private static Double round(double v, int places) {
        double f = Math.pow(10, places);
        return Math.round(v * f) / f;
    }
}
