package com.dairy.service;

import com.dairy.model.Breed;
import com.dairy.model.Herd;
import com.dairy.model.HerdEvent;
import com.dairy.repo.HerdRepository;
import com.dairy.repo.HerdEventRepository;
import com.dairy.repo.MilkRecordRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class HerdService {
    @Autowired
    private HerdRepository herdRepository;

    @Autowired
    private MilkRecordRepository milkRecordRepository;

    @Autowired
    private HerdEventRepository herdEventRepository;

    @Autowired
    private MilkPotentialService milkPotentialService;

    @Autowired
    private com.dairy.repo.BreedRepository breedRepository;

    @Autowired
    private com.dairy.repo.HerdWeightRecordRepository herdWeightRecordRepository;

    public List<Herd> getAllHerds() {
        return enrichAll(herdRepository.findAll());
    }

    public Optional<Herd> getHerdById(Long id) {
        return herdRepository.findById(id).map(herd -> {
            enrichHerd(herd);
            return herd;
        });
    }

    /**
     * Several animals, enriched together. Calling getHerdById in a loop costs four queries
     * per animal; this costs four in total, which matters for callers that evaluate a whole
     * group at once (see PlanAdequacyService).
     */
    public List<Herd> getHerdsByIds(java.util.Collection<Long> ids) {
        if (ids == null || ids.isEmpty()) return new ArrayList<>();
        return enrichAll(herdRepository.findAllById(ids));
    }

    public Herd saveHerd(Herd herd) {
        if ("DISPOSED".equals(herd.getStatus())) {
            if (herd.getDisposedDate() == null) herd.setDisposedDate(java.time.LocalDate.now());
        } else {
            herd.setDisposedDate(null);
        }
        return herdRepository.save(herd);
    }

    @org.springframework.transaction.annotation.Transactional
    public void deleteHerd(Long id) {
        milkRecordRepository.deleteByHerdId(id);
        herdEventRepository.deleteByHerdId(id);
        herdRepository.deleteById(id);
    }

    public Optional<Herd> getHerdByTagNumber(String tagNumber) {
        return herdRepository.findByTagNumber(tagNumber).map(herd -> {
            enrichHerd(herd);
            return herd;
        });
    }

    public List<Herd> getHerdsByAnimalType(String animalType) {
        return enrichAll(herdRepository.findByAnimalType(animalType));
    }

    private void enrichHerd(Herd herd) {
        List<Herd> single = new ArrayList<>();
        single.add(herd);
        enrichAll(single);
    }

    /**
     * Fills in the derived fields - 30-day average, lactation number, weight, milk potential,
     * DIM - for a whole list of animals.
     *
     * This costs three queries no matter how many animals are passed. Doing it one animal at a
     * time cost four to five each, which on the herd list meant hundreds of round trips.
     */
    private List<Herd> enrichAll(List<Herd> herds) {
        if (herds.isEmpty()) return herds;

        List<Long> herdIds = new ArrayList<>();
        for (Herd herd : herds) {
            if (herd.getId() != null) herdIds.add(herd.getId());
        }
        if (herdIds.isEmpty()) return herds;

        // 1. Daily milk totals, aggregated by the database rather than in the loop below.
        Map<Long, List<Double>> dailyTotalsByHerd = new HashMap<>();
        for (Object[] row : milkRecordRepository.sumDailyByHerdIdsSince(herdIds, LocalDate.now().minusDays(30))) {
            if (row[0] == null) continue;
            Long herdId = ((Number) row[0]).longValue();
            double litres = row[2] != null ? ((Number) row[2]).doubleValue() : 0.0;
            dailyTotalsByHerd.computeIfAbsent(herdId, key -> new ArrayList<>()).add(litres);
        }

        // 2. Event history for every animal at once, newest first (the ordering is preserved
        //    within each animal's list).
        Map<Long, List<HerdEvent>> eventsByHerd = new HashMap<>();
        for (HerdEvent event : herdEventRepository.findByHerdIdInOrderByEventDateDesc(herdIds)) {
            eventsByHerd.computeIfAbsent(event.getHerdId(), key -> new ArrayList<>()).add(event);
        }

        // 3. Breed formulas - a handful of rows, looked up by name below.
        Map<String, Breed> breedsByName = new HashMap<>();
        for (Breed breed : breedRepository.findAll()) {
            if (breed.getName() != null) breedsByName.put(breed.getName().toLowerCase(), breed);
        }

        // 4. Latest weight records
        Map<Long, Double> latestWeightsByHerd = new HashMap<>();
        for (com.dairy.model.HerdWeightRecord weightRecord : herdWeightRecordRepository.findLatestByHerdIdIn(herdIds)) {
            if (weightRecord.getWeightKg() != null) {
                latestWeightsByHerd.put(weightRecord.getHerdId(), weightRecord.getWeightKg());
            }
        }

        for (Herd herd : herds) {
            List<HerdEvent> events = eventsByHerd.getOrDefault(herd.getId(), Collections.emptyList());

            herd.setAvgMilk30Days(averageOf(dailyTotalsByHerd.get(herd.getId())));

            // Counted here rather than by the database. equalsIgnoreCase matches what the old
            // countBy query did, since MySQL's default collation is case-insensitive.
            int lactationCount = 0;
            for (HerdEvent event : events) {
                if ("CALF_DELIVERED".equalsIgnoreCase(event.getEventType())) lactationCount++;
            }
            herd.setLactationNumber(lactationCount);

            Double latestWeight = latestWeightsByHerd.get(herd.getId());
            calculateWeightAndStatus(herd, breedsByName, latestWeight);

            MilkPotentialService.MilkPotentialResult potentialResult =
                    milkPotentialService.calculatePotential(herd, lactationCount);
            herd.setMilkPotential(potentialResult.getPotential());
            herd.setMilkPotentialConfidence(potentialResult.getConfidence());

            applyDimAndPregnancy(herd, events);

            if (DewormingSchedule.applies(herd)) {
                DewormingSchedule.Next dew = DewormingSchedule.compute(herd, events, LocalDate.now());
                herd.setLastDewormingDate(dew.lastDone());
                herd.setNextDewormingDate(dew.nextDue());
                herd.setNextDewormingDose(dew.dose());
            }
        }
        return herds;
    }

    /** Mean of the per-day totals, matching the old "sum of days / number of days" behaviour. */
    private double averageOf(List<Double> dailyTotals) {
        if (dailyTotals == null || dailyTotals.isEmpty()) return 0.0;
        double total = 0.0;
        for (Double litres : dailyTotals) {
            total += litres != null ? litres : 0.0;
        }
        return total / dailyTotals.size();
    }

    /**
     * Derives DIM and pregnancy duration from HerdEvent history rather than a
     * stored field, since neither exists on the animal record today. Used by
     * the Feed Optimizer's stage resolution (see service.optimizer.AnimalStageResolver).
     */
    private void applyDimAndPregnancy(Herd herd, List<HerdEvent> events) {
        // DIM: Days since last calving/calf delivered or lactation started
        events.stream()
                .filter(e -> "CALVING".equalsIgnoreCase(e.getEventType()) || "CALF_DELIVERED".equalsIgnoreCase(e.getEventType()) || "LACTATION_STARTED".equalsIgnoreCase(e.getEventType()))
                .findFirst()
                .ifPresent(e -> herd.setDim((int) java.time.temporal.ChronoUnit.DAYS.between(e.getEventDate(), LocalDate.now())));

        // Pregnancy: Days since last AI (SEMEN_GIVEN) or PREGNANCY_CONFIRMED
        events.stream()
                .filter(e -> "PREGNANCY_CONFIRMED".equalsIgnoreCase(e.getEventType()) || "SEMEN_GIVEN".equalsIgnoreCase(e.getEventType()) || "AI_DONE".equalsIgnoreCase(e.getEventType()))
                .findFirst()
                .ifPresent(e -> {
                    int days = (int) java.time.temporal.ChronoUnit.DAYS.between(e.getEventDate(), LocalDate.now());
                    herd.setPregnancyDaysPregnant(days);
                    herd.setPregnancyStatus(days + " days pregnant");
                });
    }

    /**
     * Weight from a tape measurement, using the same breed formula the animal card uses.
     * Pass a measured body length to use it directly; otherwise the breed's length ratio applies.
     */
    public Double estimateWeightKg(String breedName, Double heartGirthCm, Double bodyLengthCm) {
        if (heartGirthCm == null || heartGirthCm <= 0) return null;

        String name = breedName != null ? breedName : "Unknown";
        com.dairy.model.Breed breedMaster = breedRepository.findByName(name)
                .orElseGet(() -> breedRepository.findByName("Unknown").orElse(null));
        if (breedMaster == null) return null;

        double weight = applyBreedFormula(breedMaster, heartGirthCm, bodyLengthCm);
        return Math.round(weight * 10.0) / 10.0;
    }

    private double applyBreedFormula(com.dairy.model.Breed breedMaster, double hGirth, Double measuredLengthCm) {
        if ("AGARWAL".equalsIgnoreCase(breedMaster.getFormulaType())) {
            // Agarwal: (Girth_in * Length_in) / Y (output is in seers, convert to kg by multiplying by 0.933)
            double girthInches = hGirth / 2.54;
            double lengthInches = measuredLengthCm != null && measuredLengthCm > 0
                    ? measuredLengthCm / 2.54
                    : girthInches * breedMaster.getLengthRatio();
            double Y = girthInches < 65 ? 9.0 : (girthInches <= 80 ? 8.5 : 8.0);
            return ((girthInches * lengthInches) / Y) * 0.933;
        }
        // SCHAEFFER: (Girth_cm^2 * Length_cm) / 10830 (dividing by 10830 already converts to kg)
        double lengthCm = measuredLengthCm != null && measuredLengthCm > 0
                ? measuredLengthCm
                : hGirth * breedMaster.getLengthRatio();
        return (hGirth * hGirth * lengthCm) / 10830.0;
    }

    private void calculateWeightAndStatus(Herd herd, Map<String, Breed> breedsByName, Double latestWeight) {
        if ((herd.getHeartGirth() == null || herd.getHeartGirth() <= 0) && latestWeight == null) {
            herd.setCalculatedWeight(0.0);
            herd.setWeightStatus("Unknown");
            return;
        }

        Double hGirth = herd.getHeartGirth();
        String breedName = herd.getBreed() != null ? herd.getBreed() : "Unknown";

        // Resolved from the pre-loaded breed table - same fallback to "Unknown" as before.
        Breed breedMaster = breedsByName.get(breedName.toLowerCase());
        if (breedMaster == null) breedMaster = breedsByName.get("unknown");

        if (breedMaster == null) {
            herd.setCalculatedWeight(0.0);
            herd.setWeightStatus("Unknown");
            return;
        }

        double weight;
        if (latestWeight != null) {
            weight = latestWeight;
        } else {
            weight = applyBreedFormula(breedMaster, hGirth, null);
        }

        herd.setCalculatedWeight(Math.round(weight * 10.0) / 10.0); // 1 decimal place

        // Status Determination
        if (herd.getHealthStatus() != null && !herd.getHealthStatus().equalsIgnoreCase("HEALTHY")) {
            herd.setWeightStatus(herd.getHealthStatus());
            return;
        }

        // Special thresholds for Calves
        boolean isCalf = "CALF".equalsIgnoreCase(herd.getAnimalStatus());
        if (herd.getBirthDate() != null) {
            int ageMonths = java.time.Period.between(herd.getBirthDate(), java.time.LocalDate.now()).getYears() * 12 
                    + java.time.Period.between(herd.getBirthDate(), java.time.LocalDate.now()).getMonths();
            if (ageMonths < 12) {
                isCalf = true;
            }
        }

        if (isCalf) {
            if (weight < 25.0) herd.setWeightStatus("Low");
            else if (weight < 80.0) herd.setWeightStatus("Avg");
            else herd.setWeightStatus("Healthy");
            return;
        }

        if (weight <= breedMaster.getVeryLowMax()) herd.setWeightStatus("Very Low");
        else if (weight <= breedMaster.getLowMax()) herd.setWeightStatus("Low");
        else if (weight <= breedMaster.getBelowAvgMax()) herd.setWeightStatus("Below Avg");
        else if (weight <= breedMaster.getAvgMax()) herd.setWeightStatus("Avg");
        else if (weight <= breedMaster.getSlightlyOverweightMax()) herd.setWeightStatus("Above Avg");
        else herd.setWeightStatus("Overweight");
    }
}
