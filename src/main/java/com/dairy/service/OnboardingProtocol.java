package com.dairy.service;

import com.dairy.model.Herd;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * What a newly arrived animal goes through before it joins the herd: five numbered steps.
 *
 *   1 Arrival check  - drinking and dung; can be marked again on any day, each time dated
 *   2 To do          - tick medicine and deworming
 *   3 Vet check
 *   4 Vaccination    - "not needed" up front for a calf too young for it
 *   5 Feed           - farm ration raised in four stages by day, then the animal joins the herd
 *
 * The screen shows no explanations, only titles and answers to tap; an answer starting with "!"
 * is a problem. Only an animal whose status is CALF gets the calf checks, so a heifer is never
 * treated as a milk-fed calf. Days count from the arrival day (day 0).
 */
public final class OnboardingProtocol {

    public static final int DEFAULT_QUARANTINE_DAYS = 14;

    /** Event types written to the animal's history by onboarding. */
    public static final String STARTED_EVENT = "QUARANTINE_STARTED";
    public static final String ENDED_EVENT = "QUARANTINE_ENDED";
    public static final String VET_CHECK_EVENT = "VET_CHECK";
    public static final String VACCINATION_EVENT = "VACCINATION_DONE";
    public static final String HEALTH_CHECK_EVENT = "HEALTH_CHECK";

    public static final String ARRIVAL = "ARRIVAL";
    public static final String TICK_TREATMENT = "TICK_TREATMENT";
    public static final String DEWORMING = "DEWORMING";
    public static final String VET_CHECK = "VET_CHECK";
    public static final String VACCINATION = "VACCINATION";
    public static final String RELEASE = "RELEASE";

    /** Share of the farm ration in each quarter of the quarantine. */
    private static final int[] FEED_PCT = {25, 50, 75, 100};

    /** With no status recorded, younger than this is taken as a milk-fed calf. */
    private static final int CALF_MAX_AGE_DAYS = 90;

    /** Calves younger than this at arrival are too young for FMD / HS-BQ vaccines. */
    private static final int VACCINE_MIN_AGE_DAYS = 120;

    private static final Set<String> TYPES = Set.of("COW", "BUFFALO", "GOAT");

    /**
     * @param stepNo   1-5, the numbered step it belongs to
     * @param fromDay  first day the step can be done, counted from arrival; -1 means the end of quarantine
     * @param toDay    last day before it shows as late; -1 means two days after the end of quarantine
     * @param choices  answers to tap; "!" marks a problem
     */
    public record StepDef(int stepNo, String key, String title, List<String> choices, int fromDay, int toDay) {}

    private OnboardingProtocol() {}

    /** Livestock only; poultry batches have no onboarding. */
    public static boolean applies(Herd herd) {
        return herd != null && herd.getAnimalType() != null
                && TYPES.contains(herd.getAnimalType().trim().toUpperCase());
    }

    /** The animal's status decides; age is used only when no status is recorded. */
    public static boolean isCalf(Herd herd, LocalDate arrival) {
        String status = herd.getAnimalStatus() == null ? "" : herd.getAnimalStatus().trim().toUpperCase();
        if (!status.isEmpty()) return status.equals("CALF");
        return herd.getBirthDate() != null
                && ChronoUnit.DAYS.between(herd.getBirthDate(), arrival) < CALF_MAX_AGE_DAYS;
    }

    public static boolean tooYoungForVaccine(Herd herd, LocalDate arrival) {
        return isCalf(herd, arrival) && herd.getBirthDate() != null
                && ChronoUnit.DAYS.between(herd.getBirthDate(), arrival) < VACCINE_MIN_AGE_DAYS;
    }

    /** The feed stage for a day of the quarantine: 25, 50, 75, then 100 % of the farm ration. */
    public static int feedSharePct(int day, int quarantineDays) {
        int q = Math.max(1, quarantineDays);
        int stage = Math.max(0, Math.min(FEED_PCT.length - 1, day * FEED_PCT.length / q));
        return FEED_PCT[stage];
    }

    public static List<StepDef> stepsFor(Herd herd, LocalDate arrival) {
        boolean calf = isCalf(herd, arrival);
        boolean milking = "LACTATING".equalsIgnoreCase(herd.getAnimalStatus());

        List<String> vet = new ArrayList<>(calf
                ? List.of("All normal", "!Fever", "!Diarrhoea", "!Navel swelling")
                : List.of("All normal", "!Fever", "!Loose dung", "!Limping"));
        if (milking) vet.add("!Udder problem");

        List<StepDef> steps = new ArrayList<>();
        steps.add(new StepDef(1, ARRIVAL, "Arrival check", List.of("Drinking well", "!Not drinking", "!Loose dung"), 0, 0));
        steps.add(new StepDef(2, TICK_TREATMENT, "Tick medicine", List.of("Spray", "Pour-on"), 1, 3));
        steps.add(new StepDef(2, DEWORMING, "Deworming", List.of("Fenbendazole", "Albendazole"), 1, 3));
        steps.add(new StepDef(3, VET_CHECK, "Vet check", vet, 2, 4));
        steps.add(new StepDef(4, VACCINATION, "Vaccination", List.of("FMD", "HS-BQ"), 7, 10));
        steps.add(new StepDef(5, RELEASE, calf ? "Join the calves" : "Join the herd", List.of(), -1, -1));
        return steps;
    }
}
