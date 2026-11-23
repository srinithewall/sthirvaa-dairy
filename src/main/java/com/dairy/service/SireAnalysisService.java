package com.dairy.service;

import com.dairy.model.Herd;
import com.dairy.model.HerdEvent;
import com.dairy.model.MilkRecord;
import com.dairy.model.SireBull;
import com.dairy.repo.HerdEventRepository;
import com.dairy.repo.HerdRepository;
import com.dairy.repo.MilkRecordRepository;
import com.dairy.repo.SireBullRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * AI Service tab analysis: finds the bull used on a cow (from her AI records' "Bull ID: …"),
 * pulls his pedigree from the sire catalogue, reads the cow's and the farm's milk records,
 * and predicts what a daughter should yield here. Computed on every request, so changing a
 * cow's bull ID changes the analysis straight away.
 */
@Service
public class SireAnalysisService {

    private static final Pattern BULL_RE =
            Pattern.compile("bull\\s*(?:id|tag|no)?\\s*[:#-]\\s*([A-Za-z0-9][A-Za-z0-9-]*)", Pattern.CASE_INSENSITIVE);
    private static final Pattern CODE_RE = Pattern.compile("\\b([A-Za-z]{2,3})\\s*-?\\s*(\\d{3,6})\\b");
    /** Farm level = the last month's milking, the same 30-day average the rest of the app shows. */
    private static final int FARM_WINDOW_DAYS = 30;

    private final HerdRepository herdRepo;
    private final HerdEventRepository eventRepo;
    private final MilkRecordRepository milkRepo;
    private final SireBullRepository sireRepo;
    private final MilkPotentialService potentialService;
    private final MilkProjectionService projectionService;

    public SireAnalysisService(HerdRepository herdRepo, HerdEventRepository eventRepo,
                               MilkRecordRepository milkRepo, SireBullRepository sireRepo,
                               MilkPotentialService potentialService, MilkProjectionService projectionService) {
        this.projectionService = projectionService;
        this.herdRepo = herdRepo;
        this.eventRepo = eventRepo;
        this.milkRepo = milkRepo;
        this.sireRepo = sireRepo;
        this.potentialService = potentialService;
    }

    /**
     * Her target milk capacity (L/day over a lactation) when healthy at her ideal weight / BCS 3–3.5:
     * the farm's own figure if set, else the breed/age/lactation estimate - the same target the
     * Efficiency screen uses.
     */
    Double targetCapacity(Herd h, List<HerdEvent> events) {
        if (h.getMilkPotentialSet() != null && h.getMilkPotentialSet() > 0) return h.getMilkPotentialSet();
        int calvings = (int) events.stream().filter(e -> e.getEventType() != null
                && BreedingCycle.CALVING_TYPES.contains(e.getEventType().toUpperCase(Locale.ROOT))).count();
        int lactations = (h.getPreviousLactations() != null ? h.getPreviousLactations() : 0) + calvings;
        Integer p = potentialService.calculatePotential(h, lactations).getPotential();
        return p != null && p > 0 ? p.doubleValue() : null;
    }

    /* ─── Bull lookup ───────────────────────────────────────────── */

    static String key(String s) { return s == null ? "" : s.replaceAll("[^A-Za-z0-9]", "").toUpperCase(Locale.ROOT); }

    /** The bull reference written in an AI record, e.g. "HF-40421", or null. */
    static String bullRefOf(String details) {
        if (details == null) return null;
        Matcher m = BULL_RE.matcher(details);
        if (m.find()) return m.group(1);
        Matcher c = CODE_RE.matcher(details);
        return c.find() ? c.group(1) + "-" + c.group(2) : null;
    }

    /** Matches a typed reference ("HF-40421", "hf40421", "40421", "Tayson") to a catalogue bull. */
    static Optional<SireBull> resolve(String ref, String details, List<SireBull> sires) {
        String k = key(ref);
        if (!k.isEmpty()) {
            for (SireBull s : sires) if (key(s.getBullNo()).equals(k)) return Optional.of(s);
            String digits = k.replaceAll("\\D", "");
            if (digits.length() >= 3) {
                List<SireBull> byDigits = sires.stream()
                        .filter(s -> key(s.getBullNo()).replaceAll("\\D", "").equals(digits)).toList();
                if (byDigits.size() == 1) return Optional.of(byDigits.get(0));
            }
        }
        // Fall back to a bull name anywhere in the record ("... TAYSON").
        String text = ((ref == null ? "" : ref) + " " + (details == null ? "" : details)).toUpperCase(Locale.ROOT);
        for (SireBull s : sires) {
            String n = s.getBullName();
            if (n != null && n.length() >= 3 && Pattern.compile("\\b" + Pattern.quote(n.toUpperCase(Locale.ROOT)) + "\\b").matcher(text).find())
                return Optional.of(s);
        }
        return Optional.empty();
    }

    /* ─── Analysis ──────────────────────────────────────────────── */

    public Map<String, Object> analyse(Long herdId, String bullOverride) {
        Herd herd = herdRepo.findById(herdId).orElseThrow(() -> new NoSuchElementException("Animal not found"));
        List<SireBull> sires = sireRepo.findAll();
        List<HerdEvent> events = eventRepo.findByHerdIdOrderByEventDateDesc(herdId);
        List<HerdEvent> ais = events.stream().filter(e -> "SEMEN_GIVEN".equals(e.getEventType())).toList();

        // AI history with each record's bull resolved.
        List<Map<String, Object>> history = new ArrayList<>();
        HerdEvent chosenAi = null;
        SireBull chosen = null;
        String chosenRef = null;
        for (HerdEvent ai : ais) {
            String ref = bullRefOf(ai.getDetails());
            Optional<SireBull> s = resolve(ref, ai.getDetails(), sires);
            Map<String, Object> h = new LinkedHashMap<>();
            h.put("eventId", ai.getId());
            h.put("date", ai.getEventDate());
            h.put("bullRef", ref);
            h.put("bullNo", s.map(SireBull::getBullNo).orElse(null));
            h.put("bullName", s.map(SireBull::getBullName).orElse(null));
            h.put("outcome", outcome(ai, events));
            history.add(h);
            // The latest AI that names a bull decides; an older bull never stands in for an unknown newer one.
            if (chosenAi == null && (ref != null || s.isPresent())) {
                chosenAi = ai;
                chosenRef = ref != null ? ref : s.get().getBullNo();
                chosen = s.orElse(null);
            }
        }
        if (bullOverride != null && !bullOverride.isBlank()) {
            chosenRef = bullOverride.trim();
            chosen = resolve(chosenRef, null, sires).orElse(null);
            chosenAi = null;
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("herdId", herdId);
        out.put("aiHistory", history);
        out.put("bullRef", chosenRef);
        out.put("preview", bullOverride != null && !bullOverride.isBlank());
        if (chosen == null) {
            out.put("matched", false);
            if (chosenAi != null) out.put("aiDate", chosenAi.getEventDate());
            return out;
        }
        final SireBull bull = chosen;
        out.put("matched", true);
        out.put("sire", bull);
        if (chosenAi != null) {
            out.put("aiEventId", chosenAi.getId());
            out.put("aiDate", chosenAi.getEventDate());
            out.put("aiOutcome", outcome(chosenAi, events));
        }

        // Dam = this cow. Her current lactation's daily totals.
        LocalDate lactStart = events.stream()
                .filter(e -> "CALF_DELIVERED".equals(e.getEventType()) || "LACTATION_STARTED".equals(e.getEventType()))
                .map(HerdEvent::getEventDate).filter(Objects::nonNull).max(Comparator.naturalOrder())
                .orElse(LocalDate.now().minusDays(305));
        TreeMap<LocalDate, Double> damDaily = new TreeMap<>();
        for (MilkRecord r : milkRepo.findByHerdId(herdId)) {
            if (r.getDate() == null || r.getQuantity() == null || r.getDate().isBefore(lactStart)) continue;
            damDaily.merge(r.getDate(), r.getQuantity(), Double::sum);
        }
        List<Double> damVals = new ArrayList<>(damDaily.values());
        Double damAvg = damVals.isEmpty() ? null : mean(damVals);
        Double damPeak = damVals.isEmpty() ? null : peak7(damVals);

        // Farm: every active milking animal of the same type, last 30 days.
        String type = herd.getAnimalType();
        List<Herd> sameType = herdRepo.findByStatus("ACTIVE").stream()
                .filter(h -> Objects.equals(type, h.getAnimalType())).toList();
        List<Long> ids = sameType.stream().map(Herd::getId).toList();
        Map<Long, TreeMap<LocalDate, Double>> perCow = new HashMap<>();
        if (!ids.isEmpty()) {
            for (Object[] row : milkRepo.sumDailyByHerdIdsSince(ids, LocalDate.now().minusDays(FARM_WINDOW_DAYS))) {
                perCow.computeIfAbsent((Long) row[0], x -> new TreeMap<>())
                        .put((LocalDate) row[1], ((Number) row[2]).doubleValue());
            }
        }
        List<Double> cowAvgs = new ArrayList<>(), ratios = new ArrayList<>();
        List<Long> milkingIds = new ArrayList<>();
        for (Map.Entry<Long, TreeMap<LocalDate, Double>> en : perCow.entrySet()) {
            TreeMap<LocalDate, Double> d = en.getValue();
            if (d.size() < 7) continue;
            List<Double> v = new ArrayList<>(d.values());
            double a = mean(v);
            if (a <= 0) continue;
            cowAvgs.add(a);
            ratios.add(peak7(v) / a);
            milkingIds.add(en.getKey());
        }
        // Best case: the same milking cows at their target capacity (ideal weight, BCS 3–3.5).
        Map<Long, List<HerdEvent>> evByHerd = milkingIds.isEmpty() ? Map.of()
                : eventRepo.findByHerdIdInOrderByEventDateDesc(milkingIds).stream()
                    .collect(Collectors.groupingBy(HerdEvent::getHerdId));
        List<Double> cowTargets = sameType.stream().filter(h -> milkingIds.contains(h.getId()))
                .map(h -> targetCapacity(h, evByHerd.getOrDefault(h.getId(), List.of())))
                .filter(Objects::nonNull).toList();
        Double farmTarget = cowTargets.isEmpty() ? null : mean(cowTargets);
        Double damTarget = targetCapacity(herd, events);
        double farmAvg = cowAvgs.isEmpty() ? (damAvg != null ? damAvg : 0) : mean(cowAvgs);
        Double farmPeakRatio = ratios.isEmpty() ? null : mean(ratios);

        // Catalogue references.
        String sireFam = SireYieldPredictor.family(bull.getBreed());
        String damFam = SireYieldPredictor.family(herd.getBreed());
        Double breedMean = meanYield(sires.stream().filter(s -> Objects.equals(s.getBreed(), bull.getBreed())).toList());
        Double sireFamMean = null, damFamMean = null;
        if (sireFam != null && damFam != null && !sireFam.equals(damFam)) {
            sireFamMean = meanYield(sires.stream().filter(s -> sireFam.equals(SireYieldPredictor.family(s.getBreed()))).toList());
            damFamMean = meanYield(sires.stream().filter(s -> damFam.equals(SireYieldPredictor.family(s.getBreed()))).toList());
        }
        Double pedigree = SireYieldPredictor.pedigreeKg(bull.getDamBestYieldKg(), bull.getSireDamBestYieldKg(), bull.getSireDaughtersYieldKg());

        SireYieldPredictor.Inputs in = new SireYieldPredictor.Inputs(
                farmAvg, damAvg, damPeak, damVals.size(), farmPeakRatio, pedigree, breedMean,
                sireFamMean, damFamMean, SireYieldPredictor.exoticPct(herd.getBreed()),
                SireYieldPredictor.exoticPct(bull.getBreed()));
        SireYieldPredictor.Result res = SireYieldPredictor.predict(in);
        // Same genetics, with the farm and the dam at their target capacity.
        SireYieldPredictor.Inputs bestIn = farmTarget == null || damTarget == null ? null
                : new SireYieldPredictor.Inputs(farmTarget, damTarget,
                    damPeak != null && damAvg != null && damAvg > 0 ? damTarget * damPeak / damAvg : null,
                    SireYieldPredictor.MIN_DAM_DAYS, farmPeakRatio, pedigree, breedMean, sireFamMean, damFamMean,
                    in.damExoticPct(), in.sireExoticPct());
        SireYieldPredictor.Result best = bestIn == null ? null : SireYieldPredictor.predict(bestIn);

        String damName = herd.getAnimalName() == null || herd.getAnimalName().isBlank()
                ? herd.getTagNumber() : herd.getAnimalName().trim();
        String bullLabel = bull.getBullName() == null || bull.getBullName().isBlank()
                ? bull.getBullNo() : cap(bull.getBullName());

        Map<String, Object> dam = new LinkedHashMap<>();
        dam.put("name", damName);
        dam.put("breed", herd.getBreed());
        dam.put("exoticPct", in.damExoticPct());
        dam.put("lactationStart", lactStart);
        dam.put("daysRecorded", damVals.size());
        dam.put("avgDailyL", damAvg == null ? null : r1(damAvg));
        dam.put("peakDailyL", damPeak == null ? null : r1(damPeak));
        dam.put("targetL", damTarget == null ? null : r1(damTarget));
        dam.put("bcs", herd.getBcs());
        dam.put("imageUrl", herd.getImageUrl());
        out.put("dam", dam);

        Map<String, Object> farm = new LinkedHashMap<>();
        farm.put("avgDailyL", r1(farmAvg));
        farm.put("cowsCompared", cowAvgs.size());
        farm.put("windowDays", FARM_WINDOW_DAYS);
        farm.put("targetL", farmTarget == null ? null : r1(farmTarget));
        out.put("farm", farm);

        Map<String, Object> pred = new LinkedHashMap<>();
        pred.put("avgDailyL", res.avgDailyL());
        pred.put("peakDailyL", res.peakDailyL());
        pred.put("lowL", res.lowL());
        pred.put("highL", res.highL());
        pred.put("lactation305L", res.lactation305L());
        pred.put("damEffectL", res.damEffectL());
        pred.put("sireEffectL", res.sireEffectL());
        pred.put("breedEffectL", res.breedEffectL());
        pred.put("sireMeritPct", res.sireMeritPct());
        pred.put("pedigreeKg", pedigree == null ? null : Math.round(pedigree));
        pred.put("breedMeanKg", breedMean == null ? null : Math.round(breedMean));
        pred.put("geneticCeilingL", res.geneticCeilingL());
        pred.put("daughterExoticPct", res.daughterExoticPct());
        pred.put("damFromRecords", res.damFromRecords());
        pred.put("heritability", SireYieldPredictor.H2);
        boolean buffalo = "BUFFALO".equalsIgnoreCase(type);
        if (chosenAi != null && chosenAi.getEventDate() != null) {
            LocalDate calving = chosenAi.getEventDate().plusDays(buffalo ? 310 : 283);
            pred.put("expectedCalving", calving);
            pred.put("firstMilkFrom", calving.plusMonths(buffalo ? 42 : 30));
        }
        if (best != null) {
            Map<String, Object> b = new LinkedHashMap<>();
            b.put("avgDailyL", best.avgDailyL());
            b.put("peakDailyL", best.peakDailyL());
            b.put("lowL", best.lowL());
            b.put("highL", best.highL());
            b.put("lactation305L", best.lactation305L());
            b.put("damEffectL", best.damEffectL());
            b.put("sireEffectL", best.sireEffectL());
            b.put("breedEffectL", best.breedEffectL());
            pred.put("best", b);
        }
        out.put("prediction", pred);
        out.put("compare", compareWithOneStar(bull, sires, in, res, bestIn, best));
        out.put("farmRecord", farmRecord(bull, sires));
        out.put("insights", SireYieldPredictor.insights(in, res, bestIn, best, bullLabel, bull.getStarValue(), damName,
                bull.getDamBestYieldKg(), bull.getDamNo()));
        return out;
    }

    /**
     * What choosing this bull is worth against the average 1-star bull of his breed in the catalogue:
     * daughter's litres a day, per 305-day lactation and over {@link SireYieldPredictor#LIFETIME_LACTATIONS}
     * lactations, valued at the price the farm is actually paid. Null when there is nothing to compare.
     */
    private Map<String, Object> compareWithOneStar(SireBull bull, List<SireBull> sires,
                                                   SireYieldPredictor.Inputs in, SireYieldPredictor.Result res,
                                                   SireYieldPredictor.Inputs bestIn, SireYieldPredictor.Result best) {
        List<Double> refs = sires.stream()
                .filter(s -> Objects.equals(s.getBreed(), bull.getBreed()) && "1*".equals(s.getStarValue()))
                .map(s -> SireYieldPredictor.pedigreeKg(s.getDamBestYieldKg(), s.getSireDamBestYieldKg(), s.getSireDaughtersYieldKg()))
                .filter(Objects::nonNull).toList();
        if (refs.isEmpty() || in.pedigreeKg() == null) return null;
        double refPedigree = mean(refs);
        SireYieldPredictor.Result ref = SireYieldPredictor.predict(SireYieldPredictor.withPedigree(in, refPedigree));
        SireYieldPredictor.Result refBest = bestIn == null ? null
                : SireYieldPredictor.predict(SireYieldPredictor.withPedigree(bestIn, refPedigree));
        double price = projectionService.paidPricePerLitre();
        int n = SireYieldPredictor.LIFETIME_LACTATIONS;

        Map<String, Object> c = new LinkedHashMap<>();
        c.put("refBreed", bull.getBreed());
        c.put("refBulls", refs.size());
        c.put("refPedigreeKg", Math.round(refPedigree));
        c.put("lifetimeLactations", n);
        c.put("pricePerLitre", price > 0 ? Math.round(price) : null);
        c.put("today", compareRow(res, ref, n, price));
        if (best != null && refBest != null) c.put("best", compareRow(best, refBest, n, price));
        return c;
    }

    private static Map<String, Object> compareRow(SireYieldPredictor.Result mine, SireYieldPredictor.Result ref,
                                                  int lactations, double price) {
        double perDay = mine.avgDailyL() - ref.avgDailyL();
        long perLactation = Math.round(perDay * 305);
        long lifetime = perLactation * lactations;
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("thisBullDailyL", mine.avgDailyL());
        r.put("refDailyL", ref.avgDailyL());
        r.put("extraDailyL", r1(perDay));
        r.put("extraLactationL", perLactation);
        r.put("extraLifetimeL", lifetime);
        r.put("extraLifetimeRs", price > 0 ? Math.round(lifetime * price) : null);
        return r;
    }

    /** PD result for an AI: confirmed / not conceived / awaiting, from events up to her next AI. */
    static String outcome(HerdEvent ai, List<HerdEvent> events) {
        LocalDate d = ai.getEventDate();
        if (d == null) return "UNKNOWN";
        LocalDate next = events.stream().filter(e -> "SEMEN_GIVEN".equals(e.getEventType()))
                .map(HerdEvent::getEventDate).filter(x -> x != null && x.isAfter(d))
                .min(Comparator.naturalOrder()).orElse(d.plusDays(200));
        HerdEvent pd = events.stream()
                .filter(e -> ("PREGNANCY_CONFIRMED".equals(e.getEventType()) || "PREGNANCY_NEGATIVE".equals(e.getEventType())
                        || "CALF_DELIVERED".equals(e.getEventType()))
                        && e.getEventDate() != null && e.getEventDate().isAfter(d) && e.getEventDate().isBefore(next))
                .min(Comparator.comparing(HerdEvent::getEventDate)).orElse(null);
        if (pd != null) return "PREGNANCY_NEGATIVE".equals(pd.getEventType()) ? "NOT_CONCEIVED" : "CONCEIVED";
        if (next.isBefore(d.plusDays(200))) return "REPEATED";
        return "AWAITING_PD";
    }

    /** How this bull's semen has done on the farm so far. */
    private Map<String, Object> farmRecord(SireBull bull, List<SireBull> sires) {
        Map<Long, List<HerdEvent>> byHerd = eventRepo.findAllByOrderByEventDateDesc().stream()
                .filter(e -> e.getHerdId() != null).collect(Collectors.groupingBy(HerdEvent::getHerdId));
        Map<Long, String> names = herdRepo.findAll().stream()
                .collect(Collectors.toMap(Herd::getId, h -> h.getAnimalName() == null ? h.getTagNumber() : h.getAnimalName().trim(), (a, b) -> a));
        int ais = 0, conceived = 0, open = 0;
        List<String> cows = new ArrayList<>();
        for (Map.Entry<Long, List<HerdEvent>> en : byHerd.entrySet()) {
            for (HerdEvent e : en.getValue()) {
                if (!"SEMEN_GIVEN".equals(e.getEventType())) continue;
                Optional<SireBull> s = resolve(bullRefOf(e.getDetails()), e.getDetails(), sires);
                if (s.isEmpty() || !s.get().getBullNo().equals(bull.getBullNo())) continue;
                ais++;
                String o = outcome(e, en.getValue());
                if ("CONCEIVED".equals(o)) conceived++;
                else if ("NOT_CONCEIVED".equals(o) || "REPEATED".equals(o)) open++;
                String n = names.get(en.getKey());
                if (n != null && !cows.contains(n)) cows.add(n);
            }
        }
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("ais", ais);
        r.put("conceived", conceived);
        r.put("notConceived", open);
        r.put("cows", cows);
        return r;
    }

    private static Double meanYield(List<SireBull> list) {
        List<Double> v = list.stream().map(SireBull::getDamBestYieldKg).filter(Objects::nonNull).filter(x -> x > 0).toList();
        return v.isEmpty() ? null : mean(v);
    }

    static double mean(List<Double> v) { return v.stream().mapToDouble(Double::doubleValue).average().orElse(0); }

    /** Best 7-record rolling average (whole series if shorter). */
    static double peak7(List<Double> v) {
        if (v.size() <= 7) return mean(v);
        double best = 0, sum = 0;
        for (int i = 0; i < v.size(); i++) {
            sum += v.get(i);
            if (i >= 7) sum -= v.get(i - 7);
            if (i >= 6) best = Math.max(best, sum / 7);
        }
        return best;
    }

    private static double r1(double v) { return Math.round(v * 10) / 10.0; }

    private static String cap(String s) {
        return Arrays.stream(s.toLowerCase(Locale.ROOT).split(" "))
                .map(w -> w.isEmpty() ? w : Character.toUpperCase(w.charAt(0)) + w.substring(1))
                .collect(Collectors.joining(" "));
    }
}
