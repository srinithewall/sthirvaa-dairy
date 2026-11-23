package com.dairy.service;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Predicts the milk a daughter of a given AI bull and dam should give on this farm.
 *
 * <p>Standard animal-breeding expectation: a calf inherits half her genes from each parent,
 * and only the heritable part (h² ≈ 0.30 for milk yield) of each parent's superiority is
 * passed on. So, around this farm's own average:
 * <pre>
 *   daughter = farm average
 *            + ½·h²·(dam's yield − farm average)                    dam's transmitting ability
 *            + farm average · ½·h²·(bull pedigree − breed mean)/breed mean   bull's transmitting ability
 *            + breed effect (only when the bull is from a different breed family than the dam)
 * </pre>
 * The bull's pedigree is the station's published dam yield and his sire's dam (or sire's
 * daughters) yield; it is compared with the catalogue mean of his own breed so a "Premium" bull
 * lifts the prediction and a "1*" bull lowers it. Everything is in litres/day at farm level, so
 * the result reflects how this farm's cows actually milk, not European record yields.
 */
public final class SireYieldPredictor {

    /** Heritability of milk yield (literature range 0.25–0.35). */
    public static final double H2 = 0.30;
    /** Plausible band around the point estimate. */
    public static final double RANGE = 0.15;
    /** A breed change never moves the estimate by more than this fraction of the farm average. */
    public static final double MAX_BREED_EFFECT = 0.30;
    /** Days of dam records needed before her own yield is trusted over the farm average. */
    public static final int MIN_DAM_DAYS = 30;
    public static final double DEFAULT_PEAK_RATIO = 1.35;
    public static final double KG_PER_LITRE = 1.03;

    private SireYieldPredictor() {}

    public record Inputs(
            double farmAvgL,          // farm average litres/day per milking animal
            Double damAvgL,           // dam's average litres/day this lactation (null if none)
            Double damPeakL,          // dam's best 7-day average
            int damDays,              // days of dam records behind damAvgL
            Double farmPeakRatio,     // farm-wide peak/average ratio, fallback for the dam's
            Double pedigreeKg,        // bull's pedigree lactation yield (kg)
            Double breedMeanKg,       // catalogue mean for the bull's breed (kg)
            Double sireFamilyMeanKg,  // catalogue mean of the bull's breed family
            Double damFamilyMeanKg,   // catalogue mean of the dam's breed family (null = same family / unknown)
            Double damExoticPct,
            Double sireExoticPct) {}

    public record Result(
            double avgDailyL, double peakDailyL, double lowL, double highL, double lactation305L,
            double damEffectL, double sireEffectL, double breedEffectL,
            Double sireMeritPct, Double geneticCeilingL, Double daughterExoticPct,
            boolean damFromRecords) {}

    public static Result predict(Inputs in) {
        double farm = in.farmAvgL();
        boolean damOk = in.damAvgL() != null && in.damDays() >= MIN_DAM_DAYS;
        double damLevel = damOk ? in.damAvgL() : farm;
        double damEffect = 0.5 * H2 * (damLevel - farm);

        Double merit = null;
        double sireEffect = 0;
        if (in.pedigreeKg() != null && in.breedMeanKg() != null && in.breedMeanKg() > 0) {
            merit = (in.pedigreeKg() - in.breedMeanKg()) / in.breedMeanKg();
            sireEffect = farm * 0.5 * H2 * merit;
        }

        double breedEffect = 0;
        if (in.sireFamilyMeanKg() != null && in.damFamilyMeanKg() != null && in.damFamilyMeanKg() > 0) {
            double pct = 0.5 * (in.sireFamilyMeanKg() / in.damFamilyMeanKg() - 1);
            pct = Math.max(-MAX_BREED_EFFECT, Math.min(MAX_BREED_EFFECT, pct));
            breedEffect = farm * pct;
        }

        double avg = Math.max(0, farm + damEffect + sireEffect + breedEffect);
        double ratio = damOk && in.damPeakL() != null && in.damAvgL() > 0
                ? in.damPeakL() / in.damAvgL()
                : (in.farmPeakRatio() != null ? in.farmPeakRatio() : DEFAULT_PEAK_RATIO);
        ratio = Math.max(1.1, Math.min(1.8, ratio));

        Double ceiling = in.pedigreeKg() == null ? null : in.pedigreeKg() / 305 / KG_PER_LITRE;
        Double exotic = in.damExoticPct() == null || in.sireExoticPct() == null
                ? null : (in.damExoticPct() + in.sireExoticPct()) / 2;

        return new Result(r1(avg), r1(avg * ratio), r1(avg * (1 - RANGE)), r1(avg * (1 + RANGE)),
                Math.round(avg * 305), r1(damEffect), r1(sireEffect), r1(breedEffect),
                merit == null ? null : Math.round(merit * 1000) / 10.0,
                ceiling == null ? null : r1(ceiling), exotic, damOk);
    }

    /** Lactations a daughter is usually milked for, used for lifetime comparisons. */
    public static final int LIFETIME_LACTATIONS = 4;

    /** The same cow, farm and breed situation with a different bull's pedigree. */
    public static Inputs withPedigree(Inputs in, Double pedigreeKg) {
        return new Inputs(in.farmAvgL(), in.damAvgL(), in.damPeakL(), in.damDays(), in.farmPeakRatio(),
                pedigreeKg, in.breedMeanKg(), in.sireFamilyMeanKg(), in.damFamilyMeanKg(),
                in.damExoticPct(), in.sireExoticPct());
    }

    /** Bull pedigree: mean of his dam's best lactation and his sire's side (daughters if known, else sire's dam). */
    public static Double pedigreeKg(Double damBest, Double sireDamBest, Double sireDaughters) {
        Double sireSide = sireDaughters != null ? sireDaughters : sireDamBest;
        if (damBest != null && sireSide != null) return (damBest + sireSide) / 2;
        return damBest != null ? damBest : sireSide;
    }

    /* ─── Breed helpers ─────────────────────────────────────────── */

    private static final Pattern PCT = Pattern.compile("(\\d{1,3}(?:\\.\\d+)?)\\s*%");

    /** Breed family of a farm animal's or catalogue bull's breed text: HF, JERSEY, or the indigenous breed name. */
    public static String family(String breed) {
        String b = breed == null ? "" : breed.toLowerCase(Locale.ROOT);
        if (b.isBlank() || b.contains("unknown")) return null;
        boolean hf = b.contains("holstein") || b.matches(".*\\bhf.*") || b.contains("friesian");
        boolean jy = b.contains("jersey") || b.matches(".*\\bjy.*");
        if (hf) return "HF";
        if (jy) return "JERSEY";
        String[] indigenous = {"gir", "sahiwal", "red sindhi", "tharparkar", "kangayam", "ongole", "murrah",
                "jafarabadi", "punganur", "vechur", "hallikar", "amrit mahal", "hariana", "kankrej", "pandharpuri", "surti"};
        for (String i : indigenous) if (b.contains(i)) return i.toUpperCase(Locale.ROOT);
        return null;
    }

    /** Exotic (HF/Jersey) blood % from breed text: an explicit "65%", else cross = 50, pure exotic = 100, indigenous = 0. */
    public static Double exoticPct(String breed) {
        if (breed == null || breed.isBlank()) return null;
        Matcher m = PCT.matcher(breed);
        String fam = family(breed);
        if (m.find() && ("HF".equals(fam) || "JERSEY".equals(fam))) return Double.parseDouble(m.group(1));
        if (fam == null) return null;
        String b = breed.toLowerCase(Locale.ROOT);
        boolean exotic = "HF".equals(fam) || "JERSEY".equals(fam);
        if (!exotic) return 0.0;
        if (b.contains("cross") || b.contains("cb") || b.contains("x")) return 50.0;
        return 100.0;
    }

    /* ─── Plain-language insights ───────────────────────────────── */

    private static final java.util.Map<String, String> COUNTRY = java.util.Map.of(
            "DE", "Germany", "CA", "Canada", "US", "USA", "NL", "Netherlands", "FR", "France",
            "DK", "Denmark", "IT", "Italy", "GB", "UK", "NZ", "New Zealand", "AU", "Australia");

    /** Country of a herd-book number like "DE 14 058 46011", or null. */
    static String country(String damNo) {
        if (damNo == null || damNo.length() < 2) return null;
        return COUNTRY.get(damNo.substring(0, 2).toUpperCase(Locale.ROOT));
    }

    public static List<String> insights(Inputs in, Result r, Inputs bestIn, Result best, String bullLabel,
                                        String star, String damName, Double bullDamKg, String bullDamNo) {
        List<String> out = new ArrayList<>();
        if (r.sireMeritPct() != null) {
            double m = r.sireMeritPct();
            out.add(String.format(Locale.ROOT, "%s's pedigree is %.0f%% %s the average same-breed bull in the catalogue%s.",
                    bullLabel, Math.abs(m), m >= 0 ? "above" : "below",
                    star == null || star.isBlank() ? "" : " (station rating: " + star + ")"));
        }
        if (r.damFromRecords()) {
            double diff = in.damAvgL() - in.farmAvgL();
            out.add(String.format(Locale.ROOT, "%s averages %.1f L/day this lactation, %.1f L %s the farm average of %.1f L.",
                    damName, in.damAvgL(), Math.abs(diff), diff >= 0 ? "above" : "below", in.farmAvgL()));
        } else {
            out.add(String.format(Locale.ROOT, "%s has under %d days of milk records, so the farm average (%.1f L/day) stands in for her yield.",
                    damName, MIN_DAM_DAYS, in.farmAvgL()));
        }
        if (best != null && bestIn != null) {
            out.add(String.format(Locale.ROOT,
                    "Best case: with the herd at target weight (BCS 3–3.5) your cows' target averages %.1f L/day instead of %.1f L, and %s's target is %.1f L. Raised that way, this daughter could average about %.1f L/day (peak %.1f L).",
                    bestIn.farmAvgL(), in.farmAvgL(), damName, bestIn.damAvgL(), best.avgDailyL(), best.peakDailyL()));
        }
        if (r.breedEffectL() != 0) {
            out.add(String.format(Locale.ROOT, "Different breed family from the dam: breed change %s the estimate by %.1f L/day.",
                    r.breedEffectL() > 0 ? "raises" : "lowers", Math.abs(r.breedEffectL())));
        }
        if (r.daughterExoticPct() != null) {
            double e = r.daughterExoticPct();
            if (e > 75) out.add(String.format(Locale.ROOT,
                    "The calf will be about %.0f%% exotic blood. Above 75%% she needs good shade, cooling and feeding to reach this yield; heat stress hits high-exotic cows hardest.", e));
            else if (e >= 50) out.add(String.format(Locale.ROOT,
                    "The calf will be about %.0f%% exotic blood, the 50–75%% band that suits Indian farm conditions best.", e));
            else out.add(String.format(Locale.ROOT,
                    "The calf will be about %.0f%% exotic blood: hardier, lower yield, often higher fat.", e));
        }
        if (bullDamKg != null) {
            String c = country(bullDamNo);
            out.add(String.format(Locale.ROOT,
                    "%s's mother%s gave %,.0f kg in her best lactation (about %.0f L/day). That is a top cow's record on an elite farm, not what his daughters give: only half her genes reach the calf, and feed, weather and care decide the rest.",
                    bullLabel, c == null ? "" : " (" + c + ")", bullDamKg, bullDamKg / 305 / KG_PER_LITRE));
        }
        return out;
    }

    private static double r1(double v) { return Math.round(v * 10) / 10.0; }
}
