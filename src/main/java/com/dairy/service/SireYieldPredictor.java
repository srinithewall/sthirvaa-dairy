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
 *            + heterosis    (hybrid vigour of that cross, on the mid-parent level)
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
    /** Hybrid vigour of a first zebu × taurine cross (Indian crossbreeding studies: ~10–20% for milk). */
    public static final double HETEROSIS_INDICUS_TAURUS = 0.12;
    /** Hybrid vigour of a cross within one group (HF × Jersey, Gir × Sahiwal). */
    public static final double HETEROSIS_SAME_GROUP = 0.05;
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
            double damEffectL, double sireEffectL, double breedEffectL, double heterosisL, double heterosisPct,
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

        double heterosisPct = heterosisPct(in);
        double heterosis = (farm + breedEffect) * heterosisPct;

        double avg = Math.max(0, farm + damEffect + sireEffect + breedEffect + heterosis);
        double ratio = damOk && in.damPeakL() != null && in.damAvgL() > 0
                ? in.damPeakL() / in.damAvgL()
                : (in.farmPeakRatio() != null ? in.farmPeakRatio() : DEFAULT_PEAK_RATIO);
        ratio = Math.max(1.1, Math.min(1.8, ratio));

        Double ceiling = in.pedigreeKg() == null ? null : in.pedigreeKg() / 305 / KG_PER_LITRE;
        Double exotic = in.damExoticPct() == null || in.sireExoticPct() == null
                ? null : (in.damExoticPct() + in.sireExoticPct()) / 2;

        return new Result(r1(avg), r1(avg * ratio), r1(avg * (1 - RANGE)), r1(avg * (1 + RANGE)),
                Math.round(avg * 305), r1(damEffect), r1(sireEffect), r1(breedEffect), r1(heterosis),
                Math.round(heterosisPct * 1000) / 10.0,
                merit == null ? null : Math.round(merit * 1000) / 10.0,
                ceiling == null ? null : r1(ceiling), exotic, damOk);
    }

    /**
     * Hybrid vigour of a cross-breed calf, as a fraction of the mid-parent yield. Only counted when the
     * bull is from a different breed family than the dam (the same case as the breed effect); a
     * same-family mating keeps the herd's existing level, which the farm average already carries.
     * Zebu × taurine (Gir/Sahiwal × HF/Jersey) crosses get {@link #HETEROSIS_INDICUS_TAURUS} scaled by the
     * calf's zebu/taurine heterozygosity; crosses within one group (HF × Jersey, Gir × Sahiwal) get
     * {@link #HETEROSIS_SAME_GROUP}.
     */
    static double heterosisPct(Inputs in) {
        if (in.sireFamilyMeanKg() == null || in.damFamilyMeanKg() == null) return 0;
        double het = 0;
        if (in.damExoticPct() != null && in.sireExoticPct() != null) {
            double d = in.damExoticPct() / 100, s = in.sireExoticPct() / 100;
            het = s * (1 - d) + d * (1 - s);
        }
        return Math.max(HETEROSIS_INDICUS_TAURUS * het, HETEROSIS_SAME_GROUP);
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
        // Only what the screen doesn't already show: gaps, lifts and advice - never a repeated figure.
        List<String> out = new ArrayList<>();
        if (r.damFromRecords()) {
            double diff = in.damAvgL() - in.farmAvgL();
            if (Math.abs(diff) >= 0.1) out.add(String.format(Locale.ROOT, "%s gives %.1f L/day %s than the herd",
                    damName, Math.abs(diff), diff >= 0 ? "more" : "less"));
        } else {
            out.add(String.format(Locale.ROOT, "%s: too few milk records · herd level used", damName));
        }
        if (best != null) {
            double lift = best.avgDailyL() - r.avgDailyL();
            if (lift > 0) out.add(String.format(Locale.ROOT, "Feeding the herd to BCS 3–3.5 adds %.1f L/day to the daughter", lift));
        }
        if (r.breedEffectL() != 0) {
            out.add(String.format(Locale.ROOT, "Breed change: %s%.1f L/day", r.breedEffectL() > 0 ? "+" : "−", Math.abs(r.breedEffectL())));
        }
        if (r.heterosisL() > 0) {
            out.add(String.format(Locale.ROOT, "Hybrid vigour of the cross: +%.1f L/day", r.heterosisL()));
        }
        if (r.daughterExoticPct() != null) {
            double e = r.daughterExoticPct();
            out.add(e > 75 ? "High-exotic calf: needs shade, cooling, good feed"
                    : e >= 50 ? "Exotic level suits local conditions" : "Hardy calf: lower yield, higher fat");
        }
        if (bullDamKg != null) {
            String c = country(bullDamNo);
            out.add(String.format(Locale.ROOT, "%s's mother's yield is an elite-farm record%s, not a farm-level figure",
                    bullLabel, c == null ? "" : " (" + c + ")"));
        }
        return out;
    }

    private static double r1(double v) { return Math.round(v * 10) / 10.0; }
}
