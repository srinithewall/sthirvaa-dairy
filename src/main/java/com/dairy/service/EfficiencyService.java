package com.dairy.service;

import com.dairy.model.AmcsCollection;
import com.dairy.model.Herd;
import com.dairy.model.HerdEvent;
import com.dairy.model.MilkRecord;
import com.dairy.repo.AmcsCollectionRepository;
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
    private MilkRecordRepository milkRecordRepository;

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
                double litres = row[2] != null ? ((Number) row[2]).doubleValue() : 0.0;
                dailyByHerd.computeIfAbsent((Long) row[0], k -> new TreeMap<>()).merge((LocalDate) row[1], litres, Double::sum);
            }
        }

        Double amcsRate = amcsMilkRate(today);
        List<Map<String, Object>> cows = new ArrayList<>();
        for (Herd h : herds) {
            List<HerdEvent> events = eventsByHerd.getOrDefault(h.getId(), List.of());
            BreedingCycle cycle = BreedingCycle.of(events, today);
            boolean inMilkOrDry = "LACTATING".equals(h.getAnimalStatus()) || "DRY".equals(h.getAnimalStatus());
            if (cycle.lastCalving() == null && !inMilkOrDry) continue; // calves and heifers
            cows.add(cowRow(h, events, cycle, dailyByHerd.getOrDefault(h.getId(), new TreeMap<>()), today));
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("asOf", today);
        out.put("milkRate", round(amcsRate != null ? amcsRate : DEFAULT_MILK_RATE, 2));
        out.put("milkRateSource", amcsRate != null ? "AMCS" : "DEFAULT");
        out.put("rules", Map.of("targetDaysOpen", TARGET_DAYS_OPEN, "gestationDays", GESTATION_DAYS,
                "calvingInterval", CALVING_INTERVAL, "lactationDays", LACTATION_DAYS));
        out.put("milkPerDay", milkPerDay(today));
        out.put("cows", cows);
        return out;
    }

    private Map<String, Object> cowRow(Herd h, List<HerdEvent> events, BreedingCycle cycle,
                                       TreeMap<LocalDate, Double> daily, LocalDate today) {
        boolean dry = "DRY".equals(h.getAnimalStatus());
        LocalDate calving = cycle.lastCalving();
        Integer dim = calving != null ? (int) ChronoUnit.DAYS.between(calving, today) : null;
        double avg30 = h.getAvgMilk30Days() != null ? h.getAvgMilk30Days() : 0.0;
        Integer target = h.getMilkPotential() != null && h.getMilkPotential() > 0 ? h.getMilkPotential() : null;

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
        row.put("milkTarget", dry || target == null ? null : milkTarget(avg30, target));
        row.put("lactation", lact);
        row.put("cycleAverage", lact == null ? null
                : cycleAverage(events, daily, today, ((Number) lact.get("projected")).doubleValue(),
                        repro.get("calvingInterval") != null ? (Integer) repro.get("calvingInterval") : CALVING_INTERVAL));
        row.put("history", history(events, daily, today, h.getPreviousLactations() != null ? h.getPreviousLactations() : 0));
        row.put("flags", flags(events, cycle, daily, target, today));
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

    /**
     * Milk a day over whole calving cycles, dry days included: every completed cycle with milk
     * recorded from calving (within 10 days), plus the current one projected (305-day yield over its
     * calving interval). Cycles recorded only in part are left out rather than understating the cow.
     */
    private Map<String, Object> cycleAverage(List<HerdEvent> events, TreeMap<LocalDate, Double> daily, LocalDate today,
                                             double projectedLitres, int currentInterval) {
        TreeSet<LocalDate> calvings = calvingDates(events, today);
        double litres = projectedLitres;
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

    private Map<String, Object> milkTarget(double avg30, int target) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("avgPerDay", round(avg30, 2));
        m.put("targetPerDay", target);
        m.put("efficiency", round(100.0 * avg30 / target, 1));
        m.put("lostPerDay", round(Math.max(0, target - avg30), 2));
        return m;
    }

    private Map<String, Object> lactation(LocalDate calving, int dim, boolean dry, Integer target, double avg30,
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

        double projected;
        if (dry || dim >= LACTATION_DAYS) {
            projected = recordedAvg * Math.min(span, LACTATION_DAYS);
        } else {
            int gap = Math.max(0, dim - recordedDays);
            projected = recordedLitres + gap * recordedAvg + (LACTATION_DAYS - dim) * avg30;
        }
        l.put("projected", round(projected, 0));

        if (target != null) {
            double recordedTarget = (double) target * recordedDays;
            l.put("recordedTarget", round(recordedTarget, 0));
            l.put("achieved", recordedTarget > 0 ? round(100.0 * recordedLitres / recordedTarget, 1) : null);
            l.put("estimate", target * LACTATION_DAYS);
            l.put("projectedPct", round(100.0 * projected / (target * LACTATION_DAYS), 1));
        }
        return l;
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
    private List<String> flags(List<HerdEvent> events, BreedingCycle cycle, TreeMap<LocalDate, Double> daily,
                               Integer target, LocalDate today) {
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
        if (target != null && daily.size() >= 30) {
            double best = daily.values().stream().mapToDouble(Double::doubleValue).max().orElse(0);
            if (best < 0.7 * target) {
                out.add("Best day so far is " + round(best, 1) + " L against a target of " + target + " L; the breed may be set too high");
            }
        }
        return out;
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
