package com.dairy.service;

import com.dairy.model.Asset;
import com.dairy.model.Breed;
import com.dairy.model.Herd;
import com.dairy.model.HerdEvent;
import com.dairy.repo.BreedRepository;
import com.dairy.repo.HerdEventRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Suggested market value for each asset.
 *
 * Animals linked to a herd record (asset serial number = tag number) are priced from the animal:
 *   - calf / heifer (not yet calved): adult price x growth factor for its age. The adult price is the breed
 *     base price, or, when it was bought young, worked back from what was paid for it (so pedigree counts).
 *     A pregnant heifer climbs towards (and past) adult level as the pregnancy advances.
 *   - cow (calved): breed base price x lactation x milk yield x pregnancy x health, never below a cull floor.
 * Equipment and vehicles lose 15% of purchase cost every 6 months, down to 25% of cost.
 * Other categories (land, buildings) have no rule and keep the value that was entered.
 *
 * The owner can override any asset by hand (Asset.marketValueManual); the suggestion is still
 * computed so the two can be compared.
 */
@Service
public class AssetValuationService {

    private static final double[] LACTATION_FACTOR = {1.0, 1.0, 1.05, 1.05, 1.0, 0.85, 0.7, 0.55, 0.45};
    private static final double ADULT_FLOOR = 0.30;
    private static final double SICK_FACTOR = 0.75;
    private static final double MAX_PREGNANCY_BONUS = 0.15;
    private static final int GESTATION_COW = 283;
    private static final int GESTATION_BUFFALO = 310;
    /** A pregnant heifer starts at this share of adult value and reaches ~100% by calving. */
    private static final double PREGNANT_HEIFER_START = 0.85;
    /** Unbred heifers stop growing in value here (reached 6 months after the 24-month mark). */
    private static final double HEIFER_CAP = 0.85;
    /** Without a stage, an unfreshened animal under this age is still treated as a heifer. */
    private static final int HEIFER_UNTIL_MONTHS = 30;
    /** Purchase-anchored adult price is kept within these multiples of the breed price. */
    private static final double ANCHOR_MIN = 0.5;
    private static final double ANCHOR_MAX = 2.0;
    private static final Set<String> ANIMAL_CATEGORIES = Set.of("COW", "CALF", "BUFFALO", "GOAT");

    private static final double EQUIPMENT_STEP = 0.15;
    private static final double EQUIPMENT_FLOOR = 0.25;
    private static final Set<String> EQUIPMENT_CATEGORIES = Set.of("EQUIPMENT", "VEHICLE");

    @Autowired
    private HerdService herdService;

    @Autowired
    private HerdEventRepository eventRepository;

    @Autowired
    private BreedRepository breedRepository;

    public List<Asset> withValues(List<Asset> assets) {
        if (assets.isEmpty()) return assets;
        LocalDate today = LocalDate.now();

        Map<String, Herd> herdsByTag = new HashMap<>();
        for (Herd herd : herdService.getAllHerds()) {
            if (herd.getTagNumber() != null) herdsByTag.put(herd.getTagNumber().trim(), herd);
        }

        Map<Long, List<HerdEvent>> eventsByHerd = new HashMap<>();
        List<Long> linkedIds = new ArrayList<>();
        for (Asset asset : assets) {
            Herd herd = asset.getSerialNumber() != null ? herdsByTag.get(asset.getSerialNumber().trim()) : null;
            if (herd != null) linkedIds.add(herd.getId());
        }
        if (!linkedIds.isEmpty()) {
            for (HerdEvent e : eventRepository.findByHerdIdInOrderByEventDateDesc(linkedIds)) {
                eventsByHerd.computeIfAbsent(e.getHerdId(), k -> new ArrayList<>()).add(e);
            }
        }

        Map<String, Breed> breedsByName = new HashMap<>();
        for (Breed b : breedRepository.findAll()) {
            if (b.getName() != null) breedsByName.put(b.getName().trim().toLowerCase(), b);
        }

        for (Asset asset : assets) {
            Herd herd = asset.getSerialNumber() != null ? herdsByTag.get(asset.getSerialNumber().trim()) : null;
            if (herd != null && !isBatch(herd)) {
                valueAnimal(asset, herd, eventsByHerd.getOrDefault(herd.getId(), List.of()), breedsByName, today);
            } else if (asset.getCategory() != null
                    && EQUIPMENT_CATEGORIES.contains(asset.getCategory().trim().toUpperCase())) {
                valueEquipment(asset, today);
            } else if (asset.getCategory() != null && ANIMAL_CATEGORIES.contains(asset.getCategory().trim().toUpperCase())) {
                asset.setValuationBasis("UNLINKED");
                asset.setValuationWarning(herd == null
                        ? "Not linked to a herd animal (serial number '" + (asset.getSerialNumber() == null ? "" : asset.getSerialNumber().trim())
                                + "' matches no tag), so the value that was entered is used."
                        : "Linked to a batch, which has no per-animal valuation, so the value that was entered is used.");
            } else {
                asset.setValuationBasis("NONE");
            }
        }
        return assets;
    }

    // ── Animals ────────────────────────────────────────────────────────────────

    private void valueAnimal(Asset asset, Herd herd, List<HerdEvent> events,
                             Map<String, Breed> breeds, LocalDate today) {
        List<String> notes = new ArrayList<>();
        double[] price = basePrice(herd, breeds);
        double breedBase = price[0];
        double normalYield = price[1];
        notes.add("Base " + (herd.getBreed() != null ? herd.getBreed() : typeLabel(herd)) + " " + rupees(breedBase));

        String status = upper(herd.getAnimalStatus());
        Integer ageMonths = herd.getBirthDate() != null
                ? (int) ChronoUnit.MONTHS.between(herd.getBirthDate(), today) : null;
        int lactation = herd.getLactationNumber() != null ? herd.getLactationNumber() : 0;
        boolean milking = "LACTATING".equals(status) || "DRY".equals(status);
        boolean calf = "CALF".equals(status)
                || (ageMonths != null && ageMonths < 12 && lactation == 0 && !milking);
        // Not calved yet: calf, or heifer (unbred or pregnant for the first time)
        boolean young = calf || (!milking && lactation == 0
                && ("HEIFER".equals(status) || "PREGNANT".equals(status)
                    || (ageMonths != null && ageMonths < HEIFER_UNTIL_MONTHS)));

        // Pregnancy: confirmed after the last calving, or the status says so
        LocalDate lastCalving = latest(events, "CALF_DELIVERED", null);
        LocalDate lastPd = latest(events, "PREGNANCY_CONFIRMED", lastCalving);
        boolean pregnant = !calf && (lastPd != null || "PREGNANT".equals(status));
        long pregDays = 0;
        double gestFrac = 0;
        boolean aiKnown = true;
        if (pregnant) {
            LocalDate lastAi = latest(events, "SEMEN_GIVEN", lastCalving);
            if (lastAi == null) lastAi = latest(events, "AI_DONE", lastCalving);
            int gestation = "BUFFALO".equals(upper(herd.getAnimalType())) ? GESTATION_BUFFALO : GESTATION_COW;
            aiKnown = lastAi != null;
            pregDays = aiKnown ? ChronoUnit.DAYS.between(lastAi, today) : 60;
            pregDays = Math.max(0, Math.min(pregDays, gestation));
            gestFrac = (double) pregDays / gestation;
        }
        String pregNote = pregDays + " days pregnant" + (aiKnown ? "" : " (AI date not recorded, assumed 60)");

        double base = breedBase;
        double value;

        if (young) {
            // Worked back from what was paid, so a good-pedigree calf is not priced as an average one
            Double anchored = purchaseAnchoredPrice(asset, herd, breedBase, notes);
            if (anchored != null) base = anchored;
            int m = ageMonths != null ? ageMonths : (calf ? 6 : 18);
            if (pregnant) {
                double f = (PREGNANT_HEIFER_START + (1 - PREGNANT_HEIFER_START) * gestFrac)
                        * (1 + MAX_PREGNANCY_BONUS * gestFrac);
                value = base * f;
                notes.add("Heifer, " + pregNote + pct(f));
            } else {
                double f = growthFactor(m);
                value = base * f;
                notes.add((calf ? "Calf, " : "Heifer, ") + m + " mo" + pct(f));
            }
        } else {
            double ageF = LACTATION_FACTOR[Math.min(lactation, LACTATION_FACTOR.length - 1)];
            value = base * ageF;
            notes.add((lactation > 0 ? "Lactation " + lactation : "Adult") + pct(ageF));

            // Milk yield, only while milking and once there are recent records
            Double avg = herd.getAvgMilk30Days();
            if ("LACTATING".equals(status) && avg != null && avg > 0 && normalYield > 0) {
                double milkF = clamp(0.7 + 0.35 * (avg / normalYield), 0.75, 1.25);
                value *= milkF;
                notes.add(String.format("Milk %.1f L vs %.0f L normal", avg, normalYield) + pct(milkF));
            }

            if (pregnant) {
                double pregF = 1 + MAX_PREGNANCY_BONUS * gestFrac;
                value *= pregF;
                notes.add(pregNote + pct(pregF));
            } else if ("LACTATING".equals(status) && herd.getDim() != null && herd.getDim() > 150) {
                value *= 0.9;
                notes.add("Not pregnant at " + herd.getDim() + " DIM" + pct(0.9));
            }
        }

        // Health
        if ("SICK".equals(upper(herd.getHealthStatus()))) {
            value *= SICK_FACTOR;
            notes.add("Sick / observation" + pct(SICK_FACTOR));
        }

        if (!young && value < base * ADULT_FLOOR) {
            value = base * ADULT_FLOOR;
            notes.add("Held at cull value (" + Math.round(ADULT_FLOOR * 100) + "% of base)");
        }

        asset.setValuationBasis("ANIMAL");
        asset.setSuggestedValue(roundTo(value, 500));
        asset.setSuggestedLow(roundTo(value * 0.9, 500));
        asset.setSuggestedHigh(roundTo(value * 1.1, 500));
        asset.setValuationFactors(notes);
        asset.setValuationInputs(animalInputs(herd, ageMonths, lactation, pregnant, pregDays, base));
    }

    /**
     * Share of an adult's value for an animal that has not calved: 0.15 at birth, 0.45 at 12 months,
     * 0.69 at 24 months, then up to 0.85 at 30 months, where it stays until she is bred.
     */
    static double growthFactor(int months) {
        int m = Math.max(0, months);
        if (m <= 12) return Math.min(0.45, 0.15 + m * 0.025);
        if (m <= 24) return 0.45 + (m - 12) * 0.02;
        return Math.min(HEIFER_CAP, 0.69 + (m - 24) * (HEIFER_CAP - 0.69) / 6);
    }

    /**
     * What an adult of this animal's quality would cost, worked back from the purchase price using the
     * growth factor at the age it was bought. Only used when it was bought at up to 24 months, and kept
     * within 50%-200% of the breed price so a mis-keyed cost cannot swing the value wildly.
     */
    private Double purchaseAnchoredPrice(Asset asset, Herd herd, double breedBase, List<String> notes) {
        Double cost = asset.getValue();
        LocalDate bought = asset.getPurchaseDate();
        LocalDate born = herd.getBirthDate();
        if (cost == null || cost <= 0 || bought == null || born == null || bought.isBefore(born)) return null;
        long ageAtPurchase = ChronoUnit.MONTHS.between(born, bought);
        if (ageAtPurchase > 24) return null;
        double implied = cost / growthFactor((int) ageAtPurchase);
        double adult = clamp(implied, breedBase * ANCHOR_MIN, breedBase * ANCHOR_MAX);
        notes.add("Adult price " + rupees(adult) + " from purchase " + rupees(cost) + " at " + ageAtPurchase + " mo"
                + (adult != implied ? " (limited to " + Math.round(adult / breedBase * 100) + "% of breed price)" : ""));
        return adult;
    }

    private Map<String, String> animalInputs(Herd herd, Integer ageMonths, int lactation,
                                             boolean pregnant, long pregDays, double adultPrice) {
        Map<String, String> in = new LinkedHashMap<>();
        String name = herd.getAnimalName() != null && !herd.getAnimalName().isBlank() ? herd.getAnimalName() + " " : "";
        in.put("Animal", name + "(" + herd.getTagNumber() + ")");
        in.put("Breed", herd.getBreed() != null ? herd.getBreed() : typeLabel(herd));
        in.put("Status", herd.getAnimalStatus() != null ? herd.getAnimalStatus() : "Not set");
        in.put("Age", ageMonths != null
                ? ageMonths + " mo" + (ageMonths >= 12 ? " (" + ageMonths / 12 + " yr " + ageMonths % 12 + " mo)" : "")
                : "Birth date not recorded");
        in.put("Lactation", lactation > 0 ? String.valueOf(lactation) : "Not calved yet");
        in.put("Milk, 30-day avg", herd.getAvgMilk30Days() != null && herd.getAvgMilk30Days() > 0
                ? String.format("%.1f L/day", herd.getAvgMilk30Days()) : "No records");
        if (herd.getDim() != null && "LACTATING".equals(upper(herd.getAnimalStatus()))) {
            in.put("Days in milk", String.valueOf(herd.getDim()));
        }
        in.put("Pregnancy", pregnant ? pregDays + " days" : "Not pregnant");
        in.put("Health", herd.getHealthStatus() != null ? herd.getHealthStatus() : "Not set");
        in.put("Adult price used", rupees(adultPrice));
        return in;
    }

    /** [base price, normal daily yield] from the breed list, else a built-in estimate. */
    private double[] basePrice(Herd herd, Map<String, Breed> breeds) {
        Breed breed = herd.getBreed() != null ? breeds.get(herd.getBreed().trim().toLowerCase()) : null;
        double[] fallback = defaultPrice(herd);
        double base = breed != null && breed.getBasePrice() != null && breed.getBasePrice() > 0 ? breed.getBasePrice() : fallback[0];
        double yield = breed != null && breed.getNormalYield() != null && breed.getNormalYield() > 0 ? breed.getNormalYield() : fallback[1];
        return new double[]{base, yield};
    }

    /** Rough Karnataka market estimates; set real ones per breed on the inventory page. */
    static double[] defaultPrice(Herd herd) {
        String type = upper(herd.getAnimalType());
        String b = herd.getBreed() != null ? herd.getBreed().toLowerCase() : "";
        if ("GOAT".equals(type)) return new double[]{12000, 1.5};
        if ("BUFFALO".equals(type) || b.contains("murrah")) return new double[]{95000, 10};
        if (b.contains("gir")) return new double[]{85000, 10};
        if (b.contains("sahiwal")) return new double[]{80000, 9};
        if (b.contains("sindhi") || b.contains("tharparkar")) return new double[]{70000, 8};
        if (b.contains("holstein") || b.contains("hf")) return b.contains("cross") ? new double[]{90000, 12} : new double[]{150000, 15};
        if (b.contains("jersey")) return b.contains("cross") ? new double[]{60000, 10} : new double[]{70000, 12};
        return new double[]{60000, 9};
    }

    private static boolean isBatch(Herd herd) {
        String t = upper(herd.getAnimalType());
        return "CHICKEN".equals(t) || "DUCK".equals(t) || "FISH".equals(t) || "QUAIL".equals(t);
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

    // ── Equipment ──────────────────────────────────────────────────────────────

    private void valueEquipment(Asset asset, LocalDate today) {
        asset.setValuationBasis("EQUIPMENT");
        Double cost = asset.getValue();
        if (cost == null || cost <= 0 || asset.getPurchaseDate() == null) {
            asset.setValuationFactors(List.of("Needs a purchase cost and date"));
            return;
        }
        long months = Math.max(0, ChronoUnit.MONTHS.between(asset.getPurchaseDate(), today));
        long steps = months / 6;
        double factor = Math.max(EQUIPMENT_FLOOR, 1 - EQUIPMENT_STEP * steps);
        double v = Math.round(cost * factor);
        asset.setSuggestedValue(v);
        asset.setSuggestedLow(v);
        asset.setSuggestedHigh(v);
        List<String> notes = new ArrayList<>();
        notes.add("Purchase cost " + rupees(cost));
        if (steps == 0) notes.add("Under 6 months old, no reduction");
        else notes.add(steps + " x 6 months at -15%" + (factor == EQUIPMENT_FLOOR ? " (held at 25% of cost)" : "") + pct(factor));
        asset.setValuationFactors(notes);
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private static String upper(String s) { return s == null ? "" : s.trim().toUpperCase(); }

    private static String typeLabel(Herd herd) {
        String t = upper(herd.getAnimalType());
        return t.isEmpty() ? "animal" : t.charAt(0) + t.substring(1).toLowerCase();
    }

    private static double clamp(double v, double lo, double hi) { return Math.max(lo, Math.min(hi, v)); }

    private static double roundTo(double v, double step) { return Math.round(v / step) * step; }

    private static String pct(double factor) {
        long p = Math.round((factor - 1) * 100);
        return p == 0 ? "" : " · " + (p > 0 ? "+" : "") + p + "%";
    }

    private static String rupees(double v) {
        // Indian digit grouping (1,01,000): Java's en-IN formatter groups by threes
        String digits = String.valueOf(Math.round(v));
        if (digits.length() <= 3) return "₹" + digits;
        String head = digits.substring(0, digits.length() - 3).replaceAll("(\\d)(?=(\\d{2})+$)", "$1,");
        return "₹" + head + "," + digits.substring(digits.length() - 3);
    }
}
