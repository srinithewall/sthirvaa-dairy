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
 *   breed base price x age/lactation x milk yield x pregnancy x health, never below a cull floor.
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
        double base = price[0];
        double normalYield = price[1];
        notes.add("Base " + (herd.getBreed() != null ? herd.getBreed() : typeLabel(herd)) + " " + rupees(base));

        String status = upper(herd.getAnimalStatus());
        Integer ageMonths = herd.getBirthDate() != null
                ? (int) ChronoUnit.MONTHS.between(herd.getBirthDate(), today) : null;
        int lactation = herd.getLactationNumber() != null ? herd.getLactationNumber() : 0;
        boolean young = "CALF".equals(status) || "HEIFER".equals(status)
                || (lactation == 0 && ageMonths != null && ageMonths < 24 && !"LACTATING".equals(status));

        double value = base;

        // Age and lactation
        double ageF;
        String ageNote;
        if ("CALF".equals(status) || (young && ageMonths != null && ageMonths < 12)) {
            int m = ageMonths != null ? ageMonths : 6;
            ageF = Math.min(0.45, 0.15 + m * 0.025);
            ageNote = "Calf, " + m + " mo";
        } else if (young) {
            int m = ageMonths != null ? ageMonths : 18;
            ageF = Math.max(0.45, Math.min(0.85, 0.45 + (m - 12) * 0.02));
            ageNote = "Heifer, " + m + " mo";
        } else {
            ageF = LACTATION_FACTOR[Math.min(lactation, LACTATION_FACTOR.length - 1)];
            ageNote = lactation > 0 ? "Lactation " + lactation : "Adult";
        }
        value *= ageF;
        notes.add(ageNote + pct(ageF));

        // Milk yield, only while milking and once there are recent records
        Double avg = herd.getAvgMilk30Days();
        if ("LACTATING".equals(status) && avg != null && avg > 0 && normalYield > 0) {
            double milkF = clamp(0.7 + 0.35 * (avg / normalYield), 0.75, 1.25);
            value *= milkF;
            notes.add(String.format("Milk %.1f L vs %.0f L normal", avg, normalYield) + pct(milkF));
        }

        // Pregnancy
        LocalDate lastCalving = latest(events, "CALF_DELIVERED", null);
        LocalDate lastPd = latest(events, "PREGNANCY_CONFIRMED", lastCalving);
        if (!"CALF".equals(status) && (lastPd != null || "PREGNANT".equals(status))) {
            LocalDate lastAi = latest(events, "SEMEN_GIVEN", lastCalving);
            if (lastAi == null) lastAi = latest(events, "AI_DONE", lastCalving);
            int gestation = "BUFFALO".equals(upper(herd.getAnimalType())) ? GESTATION_BUFFALO : GESTATION_COW;
            long days = lastAi != null ? ChronoUnit.DAYS.between(lastAi, today) : 60;
            days = Math.max(0, Math.min(days, gestation));
            double pregF = 1 + MAX_PREGNANCY_BONUS * days / gestation;
            value *= pregF;
            notes.add(days + " days pregnant" + pct(pregF));
        } else if ("LACTATING".equals(status) && herd.getDim() != null && herd.getDim() > 150) {
            value *= 0.9;
            notes.add("Not pregnant at " + herd.getDim() + " DIM" + pct(0.9));
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

        double rounded = roundTo(value, 500);
        asset.setValuationBasis("ANIMAL");
        asset.setSuggestedValue(rounded);
        asset.setSuggestedLow(roundTo(value * 0.9, 500));
        asset.setSuggestedHigh(roundTo(value * 1.1, 500));
        asset.setValuationFactors(notes);
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
        if (b.contains("holstein") || b.contains("hf")) return b.contains("cross") ? new double[]{65000, 12} : new double[]{80000, 15};
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
        return "₹" + String.format(new Locale("en", "IN"), "%,d", Math.round(v));
    }
}
