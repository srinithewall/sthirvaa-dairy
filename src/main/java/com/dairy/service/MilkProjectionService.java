package com.dairy.service;

import com.dairy.model.AmcsCollection;
import com.dairy.model.Breed;
import com.dairy.model.Herd;
import com.dairy.model.HerdEvent;
import com.dairy.model.MilkDispatch;
import com.dairy.model.MilkRecord;
import com.dairy.repo.AmcsCollectionRepository;
import com.dairy.repo.BreedRepository;
import com.dairy.repo.HerdEventRepository;
import com.dairy.repo.MilkDispatchRepository;
import com.dairy.repo.MilkRecordRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * EMP - Estimated Milk Production (and the revenue it should bring) for the coming months, worked out animal by animal from the herd's own records.
 *
 * For every active milch animal (cow, buffalo, goat; not calves, not open heifers):
 *   - Where she is now: milking or dry from her status, else from her latest calving / lactation-start /
 *     dry-off events; days in milk from the last calving or lactation start.
 *   - Pregnancy: read by BreedingCycle, as on the Lactation tab - the last AI (SEMEN_GIVEN / AI_DONE)
 *     after the last calving, unless a PREGNANCY_NEGATIVE came after it. Expected calving = AI + gestation
 *     (283 days cow, 310 buffalo). Confirmed without an AI date: taken as 60 days pregnant on the PD date.
 *   - Dry-off 60 days before expected calving (or the recorded dry-off, if she is already dry).
 *     A cow that is not pregnant is dried off at 305 days in milk and stays dry for the rest of the
 *     window: no calving is assumed until an AI is recorded.
 *   - The first 7 days after a calving are colostrum for the calf: not counted as lactation or milk.
 *   - Heat stress: litres cut from 15 Mar, at full strength 1 Apr - 15 May, gone by 31 May. How much is
 *     measured from the farm's own last summer once its records cover one (each cow's mid-Apr-mid-May yield
 *     against her Jan-Feb yield, corrected for the lactation curve; median over the herd); until then a
 *     breed figure (HF up to 15%, Jersey 8%, Indian breeds and buffalo 4%).
 *   - Revenue: litres x what the farm was actually paid per litre this month so far (last month when
 *     nothing has been sold yet this month), worked out afresh on every request.
 *   - Yield: Wood's lactation curve (see AssetValuationService.lactationShape), scaled to the animal.
 *     Milking now: her 30-day average divided by the curve value at the middle of those 30 days.
 *     Dry: her average since the last calving (the curve averages 1.0 over a lactation).
 *     No milk records: the breed's normal yield (85% of it for a first lactation).
 *     After a calving in the window the same level applies to the new lactation.
 */
@Service
public class MilkProjectionService {

    static final int DRY_PERIOD_DAYS = 60;
    /** A cow that is not pregnant is dried off at the end of a normal lactation. */
    static final int LACTATION_DAYS = 305;
    /** An open cow already past LACTATION_DAYS is taken to be milked this much longer. */
    static final int OPEN_PAST_LACTATION_DAYS = 30;
    /** Taken as the pregnancy length on the PD date when no AI date is recorded. */
    static final int PD_ASSUMED_DAYS = 60;
    static final double FIRST_LACTATION_FACTOR = 0.85;
    /** Days 0-6 after calving give colostrum for the calf: counted as lactation only from day 7. */
    static final int COLOSTRUM_DAYS = 7;
    private static final Set<String> MILCH_TYPES = Set.of("COW", "BUFFALO", "GOAT");

    @Autowired
    private HerdService herdService;

    @Autowired
    private HerdEventRepository eventRepository;

    @Autowired
    private MilkRecordRepository milkRecordRepository;

    @Autowired
    private BreedRepository breedRepository;

    @Autowired
    private AmcsCollectionRepository amcsCollectionRepository;

    @Autowired
    private MilkDispatchRepository milkDispatchRepository;

    public Map<String, Object> project(int months) {
        LocalDate today = LocalDate.now();
        // Whole calendar months: this month (recorded so far + projected rest) through the month
        // in which the 9 months from today run out, so neither end shows a part-month dip.
        LocalDate end = YearMonth.from(today.plusMonths(months).minusDays(1)).atEndOfMonth();
        LocalDate monthStart = today.withDayOfMonth(1);
        int days = (int) ChronoUnit.DAYS.between(today, end) + 1;
        Price price = realisedPrice(today);
        // Whole rupees, so the revenue shown is exactly litres x the price shown
        double rate = Math.round(price.rate);

        List<Herd> herds = new ArrayList<>();
        for (Herd h : herdService.getAllHerds()) {
            if (!"ACTIVE".equalsIgnoreCase(h.getStatus()) || h.getDisposedDate() != null) continue;
            if (!MILCH_TYPES.contains(upper(h.getAnimalType())) || h.getBirdCount() != null) continue;
            herds.add(h);
        }
        List<Long> ids = herds.stream().map(Herd::getId).toList();

        Map<Long, List<HerdEvent>> eventsByHerd = new HashMap<>();
        if (!ids.isEmpty()) {
            for (HerdEvent e : eventRepository.findByHerdIdInOrderByEventDateDesc(ids)) {
                eventsByHerd.computeIfAbsent(e.getHerdId(), k -> new ArrayList<>()).add(e);
            }
        }
        Map<String, Breed> breeds = new HashMap<>();
        for (Breed b : breedRepository.findAll()) {
            if (b.getName() != null) breeds.put(b.getName().trim().toLowerCase(), b);
        }

        // Daily totals over the last year, for the lactation average of dry cows
        Map<Long, List<Object[]>> dailyByHerd = new HashMap<>();
        if (!ids.isEmpty()) {
            for (Object[] row : milkRecordRepository.sumDailyByHerdIdsSince(ids, today.minusDays(400))) {
                if (row[0] == null || row[1] == null || row[2] == null) continue;
                dailyByHerd.computeIfAbsent(((Number) row[0]).longValue(), k -> new ArrayList<>()).add(row);
            }
        }

        HeatStress heat = measureHeatStress(herds, eventsByHerd, dailyByHerd, today);

        double[] daily = new double[days];
        double[] heatLossDaily = new double[days];
        List<Map<String, Object>> animals = new ArrayList<>();
        List<boolean[]> milkingRows = new ArrayList<>();
        List<boolean[]> dryRows = new ArrayList<>();
        List<boolean[]> freshRows = new ArrayList<>();
        Map<YearMonth, int[]> eventsByMonth = new TreeMap<>(); // [calvings, dry-offs]

        for (Herd herd : herds) {
            Plan plan = plan(herd, eventsByHerd.getOrDefault(herd.getId(), List.of()),
                    dailyByHerd.getOrDefault(herd.getId(), List.of()), breeds, today);
            if (plan == null) continue;
            double heatPeak = heat.measured() != null ? heat.measured() : breedHeatPeak(herd);
            if (plan.fromRecentMilk) {
                // Her last 30 days may already be cut by heat: lift them back to a normal-season level
                plan.level /= 1 - heatPeak * heatShape(today.minusDays(15));
                plan.nextLevel = plan.level;
            }

            boolean[] milking = new boolean[days];
            boolean[] dry = new boolean[days];
            boolean[] fresh = new boolean[days];
            double total = 0, litresToday = 0, heatLoss = 0;
            for (int i = 0; i < days; i++) {
                LocalDate d = today.plusDays(i);
                boolean calved = plan.nextCalving != null && !d.isBefore(plan.nextCalving);
                boolean dried = plan.dryOff != null && !d.isBefore(plan.dryOff);
                double litres = 0;
                if (calved) {
                    int dim = (int) ChronoUnit.DAYS.between(plan.nextCalving, d);
                    if (dim < COLOSTRUM_DAYS) fresh[i] = true;
                    else {
                        milking[i] = true;
                        litres = plan.nextLevel * AssetValuationService.lactationShapeUncapped(dim);
                    }
                } else if (plan.milkingNow && !dried) {
                    if (plan.dim0 != null && plan.dim0 + i < COLOSTRUM_DAYS) fresh[i] = true;
                    else {
                        milking[i] = true;
                        litres = plan.dim0 != null
                                ? plan.level * AssetValuationService.lactationShapeUncapped(plan.dim0 + i)
                                : plan.level;
                    }
                } else if (plan.calvedBefore || plan.milkingNow) {
                    dry[i] = true;
                }
                double lost = litres * heatPeak * heatShape(d);
                litres -= lost;
                heatLossDaily[i] += lost;
                heatLoss += lost;
                if (i == 0) litresToday = litres;
                daily[i] += litres;
                total += litres;
            }
            milkingRows.add(milking);
            dryRows.add(dry);
            freshRows.add(fresh);
            if (plan.nextCalving != null && !plan.nextCalving.isAfter(end)) {
                eventsByMonth.computeIfAbsent(YearMonth.from(plan.nextCalving), k -> new int[2])[0]++;
            }
            if (plan.milkingNow && plan.dryOff != null && !plan.dryOff.isAfter(end)) {
                eventsByMonth.computeIfAbsent(YearMonth.from(plan.dryOff), k -> new int[2])[1]++;
            }

            Map<String, Object> a = new LinkedHashMap<>();
            a.put("id", herd.getId());
            a.put("tagNumber", herd.getTagNumber());
            a.put("animalName", herd.getAnimalName());
            a.put("breed", herd.getBreed());
            a.put("stateNow", plan.milkingNow ? "LACTATING" : plan.calvedBefore ? "DRY" : "HEIFER");
            a.put("dim", plan.milkingNow ? plan.dim0 : null);
            a.put("litresToday", round1(litresToday));
            a.put("expectedDryOff", plan.milkingNow && plan.dryOff != null ? plan.dryOff : null);
            a.put("expectedCalving", plan.nextCalving);
            a.put("projectedLitres", Math.round(total));
            a.put("projectedRevenue", Math.round(total * rate));
            a.put("heatPeakPct", Math.round(heatPeak * 100));
            a.put("heatLossLitres", Math.round(heatLoss));
            a.put("basis", plan.basis);
            animals.add(a);
        }

        // Daily series
        List<Map<String, Object>> dailyOut = new ArrayList<>();
        for (int i = 0; i < days; i++) {
            int milking = 0, dry = 0, fresh = 0;
            for (int r = 0; r < milkingRows.size(); r++) {
                if (milkingRows.get(r)[i]) milking++;
                else if (dryRows.get(r)[i]) dry++;
                else if (freshRows.get(r)[i]) fresh++;
            }
            Map<String, Object> p = new LinkedHashMap<>();
            p.put("date", today.plusDays(i));
            p.put("litres", round1(daily[i]));
            p.put("lactating", milking);
            p.put("dry", dry);
            p.put("fresh", fresh);
            p.put("heatLoss", round1(heatLossDaily[i]));
            dailyOut.add(p);
        }

        // Milk already recorded this month, before today: the current month is shown in full
        double recordedThisMonth = 0;
        if (today.isAfter(monthStart)) {
            for (MilkRecord r : milkRecordRepository.findByDateBetween(monthStart, today.minusDays(1))) {
                if (r.getQuantity() != null) recordedThisMonth += r.getQuantity();
            }
        }

        // Monthly: whole months; animal counts taken mid-way through the projected days of the month
        List<Map<String, Object>> monthly = new ArrayList<>();
        long totalRevenue = 0, totalMonthLitres = 0;
        YearMonth ym = YearMonth.from(today);
        while (!ym.atDay(1).isAfter(end)) {
            LocalDate from = ym.atDay(1).isBefore(today) ? today : ym.atDay(1);
            LocalDate to = ym.atEndOfMonth().isAfter(end) ? end : ym.atEndOfMonth();
            int i0 = (int) ChronoUnit.DAYS.between(today, from);
            int i1 = (int) ChronoUnit.DAYS.between(today, to);
            double projected = 0, heatLost = 0;
            for (int i = i0; i <= i1; i++) {
                projected += daily[i];
                heatLost += heatLossDaily[i];
            }
            double recorded = ym.equals(YearMonth.from(today)) ? recordedThisMonth : 0;
            double litres = recorded + projected;
            int mid = (i0 + i1) / 2;
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("month", ym.toString());
            m.put("from", ym.atDay(1));
            m.put("to", to);
            m.put("days", ym.lengthOfMonth());
            m.put("recordedLitres", Math.round(recorded));
            m.put("recordedDays", ym.equals(YearMonth.from(today)) ? (int) ChronoUnit.DAYS.between(monthStart, today) : 0);
            m.put("projectedLitres", Math.round(projected));
            m.put("litres", Math.round(litres));
            totalMonthLitres += Math.round(litres);
            m.put("avgDaily", round1(litres / ym.lengthOfMonth()));
            long revenue = Math.round(litres * rate);
            totalRevenue += revenue;
            m.put("revenue", revenue);
            m.put("heatLossLitres", Math.round(heatLost));
            m.put("heatLossRevenue", Math.round(heatLost * rate));
            m.put("lactating", dailyOut.get(mid).get("lactating"));
            m.put("dry", dailyOut.get(mid).get("dry"));
            m.put("fresh", dailyOut.get(mid).get("fresh"));
            int[] ev = eventsByMonth.getOrDefault(ym, new int[2]);
            m.put("calvings", ev[0]);
            m.put("dryOffs", ev[1]);
            monthly.add(m);
            ym = ym.plusMonths(1);
        }

        double totalLitres = Arrays.stream(daily).sum();
        animals.sort(Comparator.comparing((Map<String, Object> a) -> String.valueOf(a.get("stateNow")))
                .thenComparing(a -> -((Number) a.get("projectedLitres")).longValue()));

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("from", today);
        out.put("to", end);
        out.put("monthFrom", monthStart);
        out.put("days", days);
        out.put("months", months);
        out.put("monthCount", monthly.size());
        out.put("recordedThisMonth", Math.round(recordedThisMonth));
        out.put("totalLitres", totalMonthLitres);
        out.put("totalRevenue", totalRevenue);
        out.put("pricePerLitre", Math.round(rate));
        out.put("priceLitresSold", Math.round(price.litres));
        out.put("priceFrom", price.from);
        out.put("priceTo", price.to);
        out.put("pricePeriod", price.period);
        out.put("avgDaily", round1(totalLitres / days));
        out.put("daily", dailyOut);
        out.put("monthly", monthly);
        out.put("animals", animals);
        Map<String, Object> assumptions = new LinkedHashMap<>();
        assumptions.put("gestationCowDays", AssetValuationService.GESTATION_COW);
        assumptions.put("gestationBuffaloDays", AssetValuationService.GESTATION_BUFFALO);
        assumptions.put("dryPeriodDays", DRY_PERIOD_DAYS);
        assumptions.put("openLactationDays", LACTATION_DAYS);
        assumptions.put("pdAssumedDays", PD_ASSUMED_DAYS);
        assumptions.put("firstLactationFactor", FIRST_LACTATION_FACTOR);
        assumptions.put("colostrumDays", COLOSTRUM_DAYS);
        out.put("assumptions", assumptions);
        double heatTotal = Arrays.stream(heatLossDaily).sum();
        Map<String, Object> heatOut = new LinkedHashMap<>();
        heatOut.put("source", heat.measured() != null ? "MEASURED" : "BREED");
        heatOut.put("measuredPct", heat.measured() != null ? Math.round(heat.measured() * 100) : null);
        heatOut.put("measuredYear", heat.year());
        heatOut.put("measuredCows", heat.cows());
        heatOut.put("totalLossLitres", Math.round(heatTotal));
        heatOut.put("totalLossRevenue", Math.round(heatTotal * rate));
        out.put("heatStress", heatOut);
        return out;
    }

    /** Average paid per litre over a period, and the period it came from. */
    private record Price(double rate, double litres, LocalDate from, LocalDate to, String period) {}

    /**
     * Everything the farm was paid for milk (society collections and customer dispatches) divided by the
     * litres: this month so far; if nothing is sold yet this month, last month; failing that, the last year.
     */
    private Price realisedPrice(LocalDate today) {
        LocalDate monthStart = today.withDayOfMonth(1);
        LocalDate lastMonthStart = monthStart.minusMonths(1);
        Object[][] periods = {
                {monthStart, today, "THIS_MONTH"},
                {lastMonthStart, monthStart.minusDays(1), "LAST_MONTH"},
                {today.minusDays(365), today, "LAST_YEAR"},
        };
        for (Object[] period : periods) {
            LocalDate from = (LocalDate) period[0], to = (LocalDate) period[1];
            double amount = 0, litres = 0;
            for (AmcsCollection c : amcsCollectionRepository.findByDateBetweenOrderByDateDescShiftAsc(from, to)) {
                if (c.getQuantity() == null || c.getQuantity() <= 0 || c.getAmount() == null || c.getAmount() <= 0) continue;
                amount += c.getAmount();
                litres += c.getQuantity();
            }
            for (MilkDispatch d : milkDispatchRepository.findByDateBetween(from, to)) {
                if (!"CUSTOMER".equalsIgnoreCase(d.getDispatchType())) continue;
                if (d.getQuantity() == null || d.getQuantity() <= 0 || d.getTotalAmount() == null || d.getTotalAmount() <= 0) continue;
                amount += d.getTotalAmount();
                litres += d.getQuantity();
            }
            if (litres > 0) return new Price(amount / litres, litres, from, to, (String) period[2]);
        }
        return new Price(0, 0, null, null, "NONE");
    }

    // -- Heat stress ---------------------------------------------------------------

    /** Fewer than this many cows with both a winter and a summer yield: the measurement is not trusted. */
    static final int HEAT_MIN_COWS = 3;

    /** Herd heat-stress loss measured from the last summer (null: not enough records), its year and cows. */
    private record HeatStress(Double measured, Integer year, int cows) {}

    /**
     * Share of the full heat-stress cut on a day: rises from 15 Mar to 1 Apr, full until 15 May,
     * falls to nothing by 31 May.
     */
    static double heatShape(LocalDate d) {
        LocalDate rampStart = LocalDate.of(d.getYear(), 3, 15);
        LocalDate peakStart = LocalDate.of(d.getYear(), 4, 1);
        LocalDate peakEnd = LocalDate.of(d.getYear(), 5, 15);
        LocalDate over = LocalDate.of(d.getYear(), 5, 31);
        if (d.isBefore(rampStart) || d.isAfter(over)) return 0;
        if (d.isBefore(peakStart)) {
            return (ChronoUnit.DAYS.between(rampStart, d) + 1.0) / (ChronoUnit.DAYS.between(rampStart, peakStart) + 1.0);
        }
        if (!d.isAfter(peakEnd)) return 1;
        return 1 - (double) ChronoUnit.DAYS.between(peakEnd, d) / ChronoUnit.DAYS.between(peakEnd, over);
    }

    /** Full-strength heat-stress loss by breed, used until the farm has a summer of its own records. */
    static double breedHeatPeak(Herd herd) {
        String b = herd.getBreed() != null ? herd.getBreed().toLowerCase() : "";
        String type = upper(herd.getAnimalType());
        if ("BUFFALO".equals(type) || "GOAT".equals(type)
                || b.contains("gir") || b.contains("sahiwal") || b.contains("sindhi") || b.contains("tharparkar")
                || b.contains("murrah") || b.contains("ongole") || b.contains("hallikar")) return 0.04;
        if (b.contains("jersey")) return 0.08;
        if (b.contains("hf") || b.contains("holstein") || b.contains("friesian")) {
            boolean high = b.contains("pure") || b.contains("75") || b.contains("85")
                    || (!b.contains("cross") && !b.contains("50") && !b.contains("65"));
            return high ? 0.15 : 0.12;
        }
        return 0.10;
    }

    /**
     * The last finished summer's loss, from the farm's own milk records. For each cow milking through one
     * lactation from mid-January to mid-May: her 1 Apr-15 May average against her 15 Jan-28 Feb average,
     * each divided by the lactation curve at its middle so the normal decline is not counted as heat.
     * The herd figure is the median, kept within 0-35%.
     */
    private HeatStress measureHeatStress(List<Herd> herds, Map<Long, List<HerdEvent>> eventsByHerd,
                                         Map<Long, List<Object[]>> dailyByHerd, LocalDate today) {
        int year = today.isAfter(LocalDate.of(today.getYear(), 5, 31)) ? today.getYear() : today.getYear() - 1;
        LocalDate winterFrom = LocalDate.of(year, 1, 15), winterTo = LocalDate.of(year, 2, 28);
        LocalDate summerFrom = LocalDate.of(year, 4, 1), summerTo = LocalDate.of(year, 5, 15);
        List<Double> ratios = new ArrayList<>();
        for (Herd herd : herds) {
            LocalDate calved = null;
            boolean interrupted = false;
            for (HerdEvent e : eventsByHerd.getOrDefault(herd.getId(), List.of())) {
                String t = upper(e.getEventType());
                LocalDate d = e.getEventDate();
                if (d == null) continue;
                boolean freshening = "CALF_DELIVERED".equals(t) || "LACTATION_STARTED".equals(t);
                if (freshening && !d.isAfter(winterFrom) && (calved == null || d.isAfter(calved))) calved = d;
                if ((freshening || "DRY_PERIOD_STARTED".equals(t)) && d.isAfter(winterFrom) && !d.isAfter(summerTo)) {
                    interrupted = true;
                }
            }
            if (calved == null || interrupted) continue;
            Double winter = average(dailyByHerd.get(herd.getId()), winterFrom, winterTo);
            Double summer = average(dailyByHerd.get(herd.getId()), summerFrom, summerTo);
            if (winter == null || summer == null || winter <= 0) continue;
            double winterShape = AssetValuationService.lactationShapeUncapped(
                    (int) ChronoUnit.DAYS.between(calved, LocalDate.of(year, 2, 6)));
            double summerShape = AssetValuationService.lactationShapeUncapped(
                    (int) ChronoUnit.DAYS.between(calved, LocalDate.of(year, 4, 23)));
            ratios.add((summer / summerShape) / (winter / winterShape));
        }
        if (ratios.size() < HEAT_MIN_COWS) return new HeatStress(null, null, ratios.size());
        Collections.sort(ratios);
        int n = ratios.size();
        double median = n % 2 == 1 ? ratios.get(n / 2) : (ratios.get(n / 2 - 1) + ratios.get(n / 2)) / 2;
        return new HeatStress(Math.max(0, Math.min(0.35, 1 - median)), year, n);
    }

    /** Average litres per recorded day between two dates; null when fewer than 10 days were recorded. */
    private static Double average(List<Object[]> rows, LocalDate from, LocalDate to) {
        if (rows == null) return null;
        double sum = 0;
        int n = 0;
        for (Object[] row : rows) {
            LocalDate day = row[1] instanceof java.sql.Date d ? d.toLocalDate() : (LocalDate) row[1];
            if (day.isBefore(from) || day.isAfter(to)) continue;
            sum += ((Number) row[2]).doubleValue();
            n++;
        }
        return n < 10 ? null : sum / n;
    }

    /** One animal's position and expected milestones; null when she cannot milk in the window. */
    private Plan plan(Herd herd, List<HerdEvent> events, List<Object[]> dailyRows,
                      Map<String, Breed> breeds, LocalDate today) {
        String status = upper(herd.getAnimalStatus());
        if ("CALF".equals(status)) return null;

        LocalDate lastCalving = latest(events, "CALF_DELIVERED", null);
        LocalDate lastLactStart = latest(events, "LACTATION_STARTED", null);
        LocalDate freshened = max(lastCalving, lastLactStart);
        LocalDate lastDry = latest(events, "DRY_PERIOD_STARTED", null);
        int lactation = herd.getLactationNumber() != null ? herd.getLactationNumber() : 0;

        Plan p = new Plan();
        if ("LACTATING".equals(status)) p.milkingNow = true;
        else if ("DRY".equals(status)) p.milkingNow = false;
        else p.milkingNow = freshened != null && (lastDry == null || freshened.isAfter(lastDry));
        p.calvedBefore = p.milkingNow || lactation > 0 || freshened != null || "DRY".equals(status);
        if (p.milkingNow && freshened != null) p.dim0 = (int) ChronoUnit.DAYS.between(freshened, today);

        // Pregnancy since the last calving, read the same way as the Lactation tab: a negative PD
        // after the last AI / positive PD means open; an AI not yet checked counts as the conception.
        BreedingCycle cycle = BreedingCycle.of(events, today);
        int gestation = "BUFFALO".equals(upper(herd.getAnimalType()))
                ? AssetValuationService.GESTATION_BUFFALO : AssetValuationService.GESTATION_COW;
        LocalDate conceived = null;
        if (cycle.pregnant()) {
            // A PD with no AI recorded before it: taken as PD_ASSUMED_DAYS into the pregnancy
            conceived = cycle.confirmed() && cycle.conception().equals(cycle.pdDate())
                    ? cycle.pdDate().minusDays(PD_ASSUMED_DAYS) : cycle.conception();
        }
        if (conceived != null) {
            LocalDate due = conceived.plusDays(gestation);
            // A due date already passed without a calving record: expected any day now
            p.nextCalving = due.isBefore(today) ? today : due;
            if (p.milkingNow) {
                LocalDate dryOff = p.nextCalving.minusDays(DRY_PERIOD_DAYS);
                p.dryOff = dryOff.isBefore(today) ? today : dryOff;
            }
        } else if (p.milkingNow && freshened != null) {
            // Open (not inseminated, or PD negative): no calving in sight, so she is dried off at the
            // end of a normal lactation and stays dry until a new pregnancy is recorded. One already
            // past it is given OPEN_PAST_LACTATION_DAYS more, since she is evidently still being milked.
            LocalDate dryOff = freshened.plusDays(LACTATION_DAYS);
            LocalDate earliest = today.plusDays(OPEN_PAST_LACTATION_DAYS);
            p.dryOff = dryOff.isBefore(earliest) && !dryOff.isAfter(today) ? earliest : dryOff;
        }
        if (!p.calvedBefore && p.nextCalving == null) return null; // open heifer: no milk in the window

        // Yield level: litres at "1.0" on the lactation curve
        double normal = normalYield(herd, breeds);
        Double avg30 = herd.getAvgMilk30Days();
        Double lactationAvg = freshened != null ? averageSince(dailyRows, freshened) : null;
        if (p.milkingNow && avg30 != null && avg30 > 0) {
            if (p.dim0 != null) {
                p.level = avg30 / AssetValuationService.lactationShapeUncapped(Math.max(1, p.dim0 - 15));
                p.fromRecentMilk = true;
                p.basis = String.format("30-day avg %.1f L at %d DIM", avg30, p.dim0);
            } else {
                p.level = avg30;
                p.fromRecentMilk = true;
                p.basis = String.format("30-day avg %.1f L, no calving date (flat)", avg30);
            }
        } else if (!p.milkingNow && lactationAvg != null && lactationAvg > 0) {
            p.level = lactationAvg;
            p.basis = String.format("Last lactation avg %.1f L", lactationAvg);
        } else {
            p.level = lactation == 0 && !p.milkingNow ? normal * FIRST_LACTATION_FACTOR : normal;
            p.basis = String.format("No milk records, breed normal %.0f L", normal)
                    + (lactation == 0 && !p.milkingNow ? " x 85% (first lactation)" : "");
        }
        p.nextLevel = p.level;
        return p;
    }

    private double normalYield(Herd herd, Map<String, Breed> breeds) {
        Breed breed = herd.getBreed() != null ? breeds.get(herd.getBreed().trim().toLowerCase()) : null;
        if (breed != null && breed.getNormalYield() != null && breed.getNormalYield() > 0) return breed.getNormalYield();
        return AssetValuationService.defaultPrice(herd)[1];
    }

    private static Double averageSince(List<Object[]> rows, LocalDate since) {
        double sum = 0;
        int n = 0;
        for (Object[] row : rows) {
            LocalDate day = row[1] instanceof java.sql.Date d ? d.toLocalDate() : (LocalDate) row[1];
            if (day.isBefore(since)) continue;
            sum += ((Number) row[2]).doubleValue();
            n++;
        }
        return n == 0 ? null : sum / n;
    }

    private static LocalDate latest(List<HerdEvent> events, String type, LocalDate after) {
        LocalDate best = null;
        for (HerdEvent e : events) {
            if (!type.equalsIgnoreCase(e.getEventType()) || e.getEventDate() == null) continue;
            if (after != null && !e.getEventDate().isAfter(after)) continue;
            if (best == null || e.getEventDate().isAfter(best)) best = e.getEventDate();
        }
        return best;
    }

    private static LocalDate max(LocalDate a, LocalDate b) {
        if (a == null) return b;
        if (b == null) return a;
        return a.isAfter(b) ? a : b;
    }

    private static double round1(double v) { return Math.round(v * 10.0) / 10.0; }

    private static String upper(String s) { return s == null ? "" : s.trim().toUpperCase(); }

    private static class Plan {
        boolean milkingNow;
        boolean calvedBefore;
        Integer dim0;
        LocalDate dryOff;
        LocalDate nextCalving;
        double level;
        double nextLevel;
        boolean fromRecentMilk;
        String basis;
    }
}
