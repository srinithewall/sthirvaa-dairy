package com.dairy.service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Checks a grown cow's base minimum (what she should weigh at BCS 3 when open, set by hand) against
 * her own data, two ways:
 *
 * <ul>
 *   <li><b>Heart girth:</b> weight goes with girth squared, so the herd's other bases per cm² of girth,
 *   times hers, say what her size suggests next to the rest of the herd. A girth taken in the last
 *   three months of pregnancy is not used: the calf and belly push it out.</li>
 *   <li><b>Breed:</b> the breed table's range, from the bottom to the top of its average band.</li>
 * </ul>
 *
 * A check agrees when the base is within half a BCS point (about 7%) of what it says; the breed
 * range is looser, as frames within a breed vary widely.
 */
public final class BaseCheck {

    private BaseCheck() {}

    /** Half a BCS point is about 7% of body weight (NRC 2001): closer than that, a check agrees. */
    public static final double TOLERANCE = 0.07;

    /** Frames within one breed vary widely, so its range is checked more loosely. */
    public static final double BREED_TOLERANCE = 0.10;

    /** From about six months pregnant the calf and belly widen her girth, so it no longer shows her frame. */
    public static final int GIRTH_PREGNANCY_DAYS = 180;

    /** Whether a girth taken {@code daysPregnantThen} into pregnancy still shows her frame. */
    public static boolean girthShowsFrame(Integer daysPregnantThen) {
        return daysPregnantThen == null || daysPregnantThen < GIRTH_PREGNANCY_DAYS;
    }

    /** LOW = her base is below what the data suggests; HIGH = above it. */
    public enum Status { OK, LOW, HIGH }

    /** The base against a band from {@code low} to {@code high}, allowing {@code tolerance} either side. */
    public static Status against(double base, double low, double high, double tolerance) {
        if (base < low * (1 - tolerance)) return Status.LOW;
        if (base > high * (1 + tolerance)) return Status.HIGH;
        return Status.OK;
    }

    /**
     * What her heart girth suggests for her base, from the other cows' bases per cm² of girth.
     * Null with fewer than two other cows to compare with.
     *
     * @param others base (kg) and girth (cm) of each other grown cow with both
     */
    public static Double girthEstimate(double girthCm, List<double[]> others) {
        if (girthCm <= 0 || others == null) return null;
        List<Double> perCm2 = new ArrayList<>();
        for (double[] o : others) {
            if (o[0] > 0 && o[1] > 0) perCm2.add(o[0] / (o[1] * o[1]));
        }
        if (perCm2.size() < 2) return null;
        return median(perCm2) * girthCm * girthCm;
    }

    static double median(List<Double> values) {
        List<Double> sorted = new ArrayList<>(values);
        Collections.sort(sorted);
        int n = sorted.size();
        return n % 2 == 1 ? sorted.get(n / 2) : (sorted.get(n / 2 - 1) + sorted.get(n / 2)) / 2;
    }
}
