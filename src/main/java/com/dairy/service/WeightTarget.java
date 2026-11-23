package com.dairy.service;

import com.dairy.model.Breed;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * The minimum healthy weight for an animal today.
 *
 * <ul>
 *   <li><b>Grown cow with a base minimum: that, plus pregnancy.</b> Her base is what she should weigh
 *   at BCS 3 when open. It is fixed by her frame, so it is the same whatever her score; the app
 *   suggests it once (the frame rule below) and after that only a person changes it.</li>
 *   <li><b>Grown or calved cow with a BCS but no base yet: her own frame.</b> Cows of one breed differ in height, and
 *   weight goes roughly with the cube of height, so no breed figure can say what a given cow should
 *   weigh. Her current weight already carries her frame; her body condition score says how much of
 *   it is condition. Using the NRC (2001) rule that one BCS point (1-5 scale) is 13.7% of the weight
 *   at BCS 3, her healthy weight is {@code weight / (1 + 0.137 x (BCS - 3))}. The weight used is the
 *   one taken when she was scored (see {@link #frameWeighing}), not her latest: a score describes the
 *   body on the day it was given, so weight she loses afterwards shows as a shortfall instead of
 *   pulling her minimum down with her.</li>
 *   <li><b>Grown cow with no BCS yet: her breed.</b> The bottom of her breed's "Avg" band (the breed
 *   table's {@code belowAvgMax}) as a fallback until she is scored.</li>
 *   <li><b>Calves and heifers: the growth curve</b> towards that breed weight - about 7% at birth,
 *   55% at 14 months (breeding size), 85% at 24 months (first calving), the full weight at 36
 *   months, straight lines in between - raised to her frame figure if she is scored thin (a heifer
 *   in good condition can still be behind on growth, so a good score never lowers the curve).</li>
 * </ul>
 *
 * <p>A pregnant animal also carries the gravid uterus (calf, fluids, membranes), which is not body
 * condition: it is added on top and kept out of the BCS correction, counted in whole weeks from the
 * insemination (it steps up once a week), using the NRC (2001) curve
 * {@code GUW = CBW x 1.825 x e^-(0.0243 - 0.0000245 t)(280 - t)} with calf birth weight
 * {@code CBW = 0.06275 x grown weight} - about 2 kg at day 100, 13 kg at day 190, 75 kg at term
 * for a 600 kg breed.
 */
public final class WeightTarget {

    private WeightTarget() {}

    /** Age (days) and share of the grown weight at each point of the growth curve. */
    private static final int[] CURVE_DAYS = {0, 426, 730, 1095};
    private static final double[] CURVE_SHARE = {0.07, 0.55, 0.85, 1.0};

    private static final double FIRST_CALVING_SHARE = 0.85;

    /** NRC (2001): one BCS point is 13.7% of body weight at BCS 3. */
    static final double WEIGHT_SHARE_PER_BCS = 0.137;
    static final double IDEAL_BCS = 3.0;

    private static final Set<String> CALVED_STATUSES = Set.of("LACTATING", "DRY", "PREGNANT");

    /** A grown cow at or above her minimum is called healthy only with at least this BCS. */
    public static final double HEALTHY_MIN_BCS = 3.5;

    /** The Sunday check flags a weight more than this share away from what her BCS says she should weigh. */
    public static final double BCS_MATCH_TOLERANCE = 0.05;

    /** A weighing within this many days of a score is taken to show the body that was scored. */
    static final int FRAME_WINDOW_DAYS = 30;

    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("d MMM", Locale.ENGLISH);

    /** One weighing, for picking the one her score describes. */
    public record Weighing(LocalDate date, double kg, boolean scale) {}

    /**
     * The weighing her body condition score describes, so her frame is read from the body that was
     * scored. Among weighings within {@link #FRAME_WINDOW_DAYS} of the score a scale reading beats a
     * tape or girth estimate, then the nearest day wins (the earlier on a tie). With none that close
     * the nearest weighing of all is used. Null without a score date or weighings.
     */
    public static Weighing frameWeighing(List<Weighing> weighings, LocalDate scoredOn) {
        if (scoredOn == null || weighings == null || weighings.isEmpty()) return null;
        Weighing best = null;
        long bestRank = Long.MAX_VALUE;
        for (Weighing w : weighings) {
            if (w == null || w.date() == null || w.kg() <= 0) continue;
            long gap = Math.abs(ChronoUnit.DAYS.between(scoredOn, w.date()));
            boolean near = gap <= FRAME_WINDOW_DAYS;
            // near scale, then near tape, then anything; each by distance, the earlier day on a tie
            long rank = (near ? (w.scale() ? 0 : 1) : 2) * 1_000_000L + gap * 2 + (w.date().isAfter(scoredOn) ? 1 : 0);
            if (rank < bestRank) { bestRank = rank; best = w; }
        }
        return best;
    }

    /**
     * @param targetKg       minimum healthy weight today (the larger of the two), pregnancy included
     * @param breedTargetKg  breed/age figure, pregnancy included
     * @param frameTargetKg  her own weight brought to BCS 3, pregnancy included; null without a weight and BCS
     * @param pregnancyKg    weight of the gravid uterus included (0 when open)
     * @param grown          a calved or fully grown animal (false for growing young stock)
     */
    public record Result(double targetKg, double breedTargetKg, Double frameTargetKg, double pregnancyKg,
                         boolean grown, String basis) {}

    /**
     * @param breed          breed row (falls back to whatever the caller resolved, e.g. "Unknown")
     * @param birthDate      may be null
     * @param animalStatus   LACTATING / DRY / PREGNANT / HEIFER / CALF ...
     * @param lactations     calvings so far (0 or null for young stock)
     * @param daysPregnant   days since the conception, null when open
     * @param currentKg      latest weight, null if never weighed
     * @param bcs            latest body condition score (1-5), null if never scored
     * @param weighedOn      date of that weight; the calf is taken out of it at its size on that
     *                       day and added back at today's size (null = today)
     * @return null when there is not enough to set a target (no breed band, or a young animal
     *         with no birth date)
     */
    public static Result of(Breed breed, LocalDate birthDate, String animalStatus, Integer lactations,
                            Integer daysPregnant, Double currentKg, Double bcs, LocalDate weighedOn,
                            LocalDate today) {
        return of(breed, birthDate, animalStatus, lactations, daysPregnant, currentKg, bcs, weighedOn, null, today);
    }

    /**
     * As above, with her frame read from {@code frame} - the weighing her BCS describes (see
     * {@link #frameWeighing}) - instead of the latest weight. Null frame = the latest weight.
     */
    public static Result of(Breed breed, LocalDate birthDate, String animalStatus, Integer lactations,
                            Integer daysPregnant, Double currentKg, Double bcs, LocalDate weighedOn,
                            Weighing frame, LocalDate today) {
        return of(breed, birthDate, animalStatus, lactations, daysPregnant, currentKg, bcs, weighedOn, frame, null, today);
    }

    /**
     * As above; a grown cow with a {@code baseKg} (her fixed base minimum, open, at BCS 3) is held
     * to that plus pregnancy, whatever her score. The frame figure is still worked out, as a check.
     */
    public static Result of(Breed breed, LocalDate birthDate, String animalStatus, Integer lactations,
                            Integer daysPregnant, Double currentKg, Double bcs, LocalDate weighedOn,
                            Weighing frame, Double baseKg, LocalDate today) {
        Double frameKg = frame != null ? Double.valueOf(frame.kg()) : currentKg;
        LocalDate frameOn = frame != null ? frame.date() : weighedOn;
        if (breed == null || breed.getBelowAvgMax() == null || breed.getBelowAvgMax() <= 0) return null;
        double mature = breed.getBelowAvgMax();
        String status = animalStatus == null ? "" : animalStatus.trim().toUpperCase();
        boolean calved = (lactations != null && lactations > 0) || CALVED_STATUSES.contains(status);

        double share;
        String breedBasis;
        if (birthDate != null && !birthDate.isAfter(today)) {
            share = curveShare(ChronoUnit.DAYS.between(birthDate, today));
            if (calved && share < FIRST_CALVING_SHARE) share = FIRST_CALVING_SHARE;
            breedBasis = share >= 1.0
                    ? "grown " + breed.getName() + " minimum " + Math.round(mature) + " kg"
                    : Math.round(share * 100) + "% of grown " + breed.getName() + " (" + Math.round(mature) + " kg) for her age";
        } else if (calved) {
            share = 1.0;
            breedBasis = "grown " + breed.getName() + " minimum " + Math.round(mature) + " kg (no birth date)";
        } else {
            return null;
        }

        boolean grown = share >= 1.0 || calved;
        boolean hasBase = grown && baseKg != null && baseKg > 0;
        // The calf grows with its dam: her own base sets its size once she has one.
        double calfOf = hasBase ? baseKg : mature;

        double pregnancy = gravidUterusKg(calfOf, wholeWeeks(daysPregnant));
        String pregText = pregnancy >= 0.5
                ? " + " + Math.round(pregnancy) + " kg pregnancy (week " + (daysPregnant / 7) + ")" : "";
        double breedTarget = Math.round(mature * share + gravidUterusKg(mature, wholeWeeks(daysPregnant)));

        boolean hasBcs = frameKg != null && frameKg > 0 && bcs != null && bcs > 0;

        // Her own frame: her weight brought to BCS 3. For a grown cow this is the whole answer -
        // cows of one breed differ in height, so a breed figure cannot set her healthy weight.
        // For young stock only a thin score counts, on top of the growth curve: a heifer in
        // good condition can still be behind on growth.
        Double frameTarget = null;
        if (hasBcs && (grown || bcs < IDEAL_BCS)) {
            // The scale reading held the calf as it was on the weighing day, not today.
            double pregnancyWhenWeighed = gravidUterusKg(calfOf, wholeWeeks(daysPregnantOn(daysPregnant, frameOn, today)));
            double maternal = Math.max(0, frameKg - pregnancyWhenWeighed);
            frameTarget = (double) Math.round(atIdealBcs(maternal, bcs) + pregnancy);
        }

        double target;
        String basis;
        // Name the day when the frame comes from an earlier weighing than the latest one.
        String frameWhen = frame != null && frameOn != null && !frameOn.equals(weighedOn) ? " on " + frameOn.format(DAY) : "";
        String frameText = frameTarget == null ? null
                : bcs == IDEAL_BCS
                ? "Her frame: " + Math.round(frameKg) + " kg" + frameWhen + " at the ideal BCS 3 is her healthy weight" + pregText
                : "Her frame: " + Math.round(frameKg) + " kg" + frameWhen + " at BCS " + bcsText(bcs) + " is about "
                  + Math.round(frameTarget - pregnancy) + " kg at BCS 3" + pregText;
        if (hasBase) {
            target = Math.round(baseKg + pregnancy);
            basis = "Her base minimum " + Math.round(baseKg) + " kg" + pregText;
        } else if (grown && frameTarget != null) {
            target = frameTarget;
            basis = frameText;
        } else if (frameTarget != null && frameTarget > breedTarget) {
            target = frameTarget;
            basis = frameText + " (growth curve: " + breedBasis + ", " + Math.round(breedTarget) + " kg)";
        } else {
            target = breedTarget;
            basis = Character.toUpperCase(breedBasis.charAt(0)) + breedBasis.substring(1) + pregText
                    + (grown ? " - no BCS yet, so the breed figure is used" : "");
        }
        return new Result(target, breedTarget, frameTarget, Math.round(pregnancy), grown, basis);
    }

    /**
     * What she should weigh at {@code bcs}: her base (BCS 3, open) moved by 13.7% per BCS point, plus the
     * calf as it was on the weighing day. The Sunday weight is checked against this.
     */
    public static double expectedAtBcs(double baseKg, double bcs, Integer daysPregnantOnWeighing) {
        return baseKg * (1 + WEIGHT_SHARE_PER_BCS * (bcs - IDEAL_BCS))
                + gravidUterusKg(baseKg, wholeWeeks(daysPregnantOnWeighing));
    }

    /** Days pregnant cut to whole weeks, so the pregnancy allowance steps up once a week. */
    static Integer wholeWeeks(Integer days) {
        return days == null ? null : (days / 7) * 7;
    }

    /** Days pregnant on an earlier date; null when she was not yet pregnant then. */
    static Integer daysPregnantOn(Integer daysPregnantToday, LocalDate date, LocalDate today) {
        if (daysPregnantToday == null || date == null || !date.isBefore(today)) return daysPregnantToday;
        long then = daysPregnantToday - ChronoUnit.DAYS.between(date, today);
        return then > 0 ? (int) then : null;
    }

    /** Weight at BCS 3 of an animal weighing {@code kg} at {@code bcs} (NRC 2001, 13.7% per point). */
    static double atIdealBcs(double kg, double bcs) {
        return kg / (1 + WEIGHT_SHARE_PER_BCS * (bcs - IDEAL_BCS));
    }

    /** NRC (2001) gravid uterus weight above the non-pregnant uterus, kg. */
    static double gravidUterusKg(double matureKg, Integer daysPregnant) {
        if (daysPregnant == null || daysPregnant <= 0) return 0;
        int t = Math.min(daysPregnant, 283);
        double calfBirthKg = 0.06275 * matureKg;
        return calfBirthKg * 1.825 * Math.exp(-(0.0243 - 0.0000245 * t) * (280 - t));
    }

    static double curveShare(long ageDays) {
        if (ageDays <= 0) return CURVE_SHARE[0];
        for (int i = 1; i < CURVE_DAYS.length; i++) {
            if (ageDays <= CURVE_DAYS[i]) {
                double t = (double) (ageDays - CURVE_DAYS[i - 1]) / (CURVE_DAYS[i] - CURVE_DAYS[i - 1]);
                return CURVE_SHARE[i - 1] + t * (CURVE_SHARE[i] - CURVE_SHARE[i - 1]);
            }
        }
        return 1.0;
    }

    private static String bcsText(double bcs) {
        return bcs == Math.floor(bcs) ? String.valueOf((int) bcs) : String.valueOf(bcs);
    }
}
