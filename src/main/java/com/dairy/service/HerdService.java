package com.dairy.service;

import com.dairy.model.Herd;
import com.dairy.repo.HerdRepository;
import com.dairy.repo.HerdEventRepository;
import com.dairy.repo.MilkRecordRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
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

    public List<Herd> getAllHerds() {
        List<Herd> herds = herdRepository.findAll();
        herds.forEach(this::enrichHerd);
        return herds;
    }

    public Optional<Herd> getHerdById(Long id) {
        return herdRepository.findById(id).map(herd -> {
            enrichHerd(herd);
            return herd;
        });
    }

    public Herd saveHerd(Herd herd) {
        return herdRepository.save(herd);
    }

    @org.springframework.transaction.annotation.Transactional
    public void deleteHerd(Long id) {
        milkRecordRepository.deleteByHerdId(id);
        herdRepository.deleteById(id);
    }

    public Optional<Herd> getHerdByTagNumber(String tagNumber) {
        return herdRepository.findByTagNumber(tagNumber).map(herd -> {
            enrichHerd(herd);
            return herd;
        });
    }

    public List<Herd> getHerdsByAnimalType(String animalType) {
        List<Herd> herds = herdRepository.findByAnimalType(animalType);
        herds.forEach(this::enrichHerd);
        return herds;
    }

    private void enrichHerd(Herd herd) {
        // 1. Avg Milk 30 Days
        List<com.dairy.model.MilkRecord> records = milkRecordRepository.findByHerdIdAndDateGreaterThanEqual(herd.getId(), LocalDate.now().minusDays(30));
        if (records.isEmpty()) {
            herd.setAvgMilk30Days(0.0);
        } else {
            java.util.Map<LocalDate, Double> dailyTotals = new java.util.HashMap<>();
            for (com.dairy.model.MilkRecord r : records) {
                dailyTotals.put(r.getDate(), dailyTotals.getOrDefault(r.getDate(), 0.0) + r.getQuantity());
            }
            double total = 0.0;
            for (Double qty : dailyTotals.values()) {
                total += qty;
            }
            herd.setAvgMilk30Days(total / dailyTotals.size());
        }

        // 2. Lactation Number (Count of CALF_DELIVERED events)
        long lactationCount = herdEventRepository.countByHerdIdAndEventType(herd.getId(), "CALF_DELIVERED");
        herd.setLactationNumber((int) lactationCount);

        // 3. Weight Calculation from Breed Master
        calculateWeightAndStatus(herd);

        // 4. Milk Potential
        MilkPotentialService.MilkPotentialResult potentialResult = milkPotentialService.calculatePotential(herd, (int) lactationCount);
        herd.setMilkPotential(potentialResult.getPotential());
        herd.setMilkPotentialConfidence(potentialResult.getConfidence());
    }

    private void calculateWeightAndStatus(Herd herd) {
        if (herd.getHeartGirth() == null || herd.getHeartGirth() <= 0) {
            herd.setCalculatedWeight(0.0);
            herd.setWeightStatus("Unknown");
            return;
        }

        Double hGirth = herd.getHeartGirth();
        String breedName = herd.getBreed() != null ? herd.getBreed() : "Unknown";
        
        com.dairy.model.Breed breedMaster = breedRepository.findByName(breedName)
                .orElseGet(() -> breedRepository.findByName("Unknown").orElse(null));

        if (breedMaster == null) {
            herd.setCalculatedWeight(0.0);
            herd.setWeightStatus("Unknown");
            return;
        }

        double weight = 0.0;
        
        if ("AGARWAL".equalsIgnoreCase(breedMaster.getFormulaType())) {
            // Agarwal: (Girth_in * Length_in) / Y (output is in seers, convert to kg by multiplying by 0.933)
            double girthInches = hGirth / 2.54;
            double lengthInches = girthInches * breedMaster.getLengthRatio();
            double Y = girthInches < 65 ? 9.0 : (girthInches <= 80 ? 8.5 : 8.0);
            weight = ((girthInches * lengthInches) / Y) * 0.933;
        } else {
            // SCHAEFFER: (Girth_cm^2 * Length_cm) / 10830 (dividing by 10830 already converts to kg)
            double lengthCm = hGirth * breedMaster.getLengthRatio();
            weight = (hGirth * hGirth * lengthCm) / 10830.0;
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
