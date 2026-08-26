package com.dairy.service;

import com.dairy.model.Herd;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.Period;

@Service
public class MilkPotentialService {

    public MilkPotentialResult calculatePotential(Herd herd, int lactationNumber) {
        if (herd.getAnimalType() == null || !herd.getAnimalType().equalsIgnoreCase("COW")) {
            return new MilkPotentialResult(null, "Insufficient Data");
        }

        if (herd.getBirthDate() != null) {
            int ageYears = Period.between(herd.getBirthDate(), LocalDate.now()).getYears();
            if (ageYears < 2) {
                return new MilkPotentialResult(null, "Not Applicable (< 2 years)");
            }
        }

        String breed = herd.getBreed() != null ? herd.getBreed().toUpperCase() : "UNKNOWN";
        double breedBase = getBreedBase(breed);
        
        double ageFactor = getAgeFactor(herd.getBirthDate());
        double lactationFactor = getLactationFactor(lactationNumber);
        double bodyConditionFactor = getBodyConditionFactor(herd.getCalculatedWeight(), breed);

        double confidenceScore = 0.0;
        if (herd.getBreed() != null) confidenceScore += 0.25;
        if (herd.getBirthDate() != null) confidenceScore += 0.25;
        if (lactationNumber > 0) confidenceScore += 0.25;
        if (herd.getHeartGirth() != null) confidenceScore += 0.25;

        String confidence = "Low";
        if (confidenceScore >= 0.75) confidence = "High";
        else if (confidenceScore >= 0.5) confidence = "Medium";
        else if (confidenceScore == 0.0) return new MilkPotentialResult(null, "Insufficient Data");

        double potential = breedBase * ageFactor * lactationFactor * bodyConditionFactor;

        return new MilkPotentialResult((int) Math.round(potential), confidence);
    }

    private double getBreedBase(String breed) {
        // Holstein / HF Percentages
        if (breed.contains("HOLSTEIN 85%") || breed.contains("HF 85%")) return 22.0;
        if (breed.contains("HOLSTEIN 75%") || breed.contains("HF 75%")) return 20.0;
        if (breed.contains("HOLSTEIN 65%") || breed.contains("HF 65%")) return 18.0;
        if (breed.contains("HOLSTEIN 50%") || breed.contains("HF 50%")) return 16.0;
        
        // Pure Holstein
        if (breed.contains("HF PURE") || (breed.contains("HOLSTEIN") && breed.contains("PURE")) || (breed.contains("HOLSTEIN") && !breed.contains("CROSS") && !breed.contains("MIX") && !breed.contains("50%") && !breed.contains("65%") && !breed.contains("75%") && !breed.contains("85%"))) return 24.0;
        
        // General Holstein Cross
        if (breed.contains("HF CROSS") || breed.contains("HOLSTEIN CROSS") || breed.contains("HF") || breed.contains("HOLSTEIN")) return 18.0;
        
        // Jersey Percentages
        if (breed.contains("JERSEY 85%")) return 15.5;
        if (breed.contains("JERSEY 75%")) return 14.5;
        if (breed.contains("JERSEY 50%")) return 13.0;
        
        // Pure Jersey
        if (breed.contains("JERSEY PURE") || (breed.contains("JERSEY") && !breed.contains("CROSS") && !breed.contains("50%") && !breed.contains("75%") && !breed.contains("85%"))) return 16.0;
        
        // General Jersey Cross
        if (breed.contains("JERSEY CROSS") || breed.contains("JERSEY")) return 14.0;
        
        // Gir
        if (breed.contains("GIR")) return 12.0;
        
        return 15.0; // Unknown/Generic
    }

    private double getAgeFactor(LocalDate birthDate) {
        if (birthDate == null) return 1.0; // Fallback
        int ageYears = Period.between(birthDate, LocalDate.now()).getYears();
        if (ageYears < 2) return 0.60;
        if (ageYears <= 3) return 0.85;
        if (ageYears <= 7) return 1.00;
        if (ageYears <= 10) return 0.90;
        return 0.75;
    }

    private double getLactationFactor(int lactation) {
        if (lactation == 1) return 0.85;
        if (lactation == 2) return 1.00;
        if (lactation == 3) return 1.05;
        if (lactation == 4) return 1.00;
        if (lactation >= 5) return 0.90;
        return 1.00; // Fallback if 0 (e.g. unknown)
    }

    private double getBodyConditionFactor(Double weight, String breed) {
        if (weight == null || weight <= 0) return 1.00; // Fallback
        
        // Expected weight per breed (approx)
        double expectedWeight = 400.0;
        if (breed.contains("HF") || breed.contains("HOLSTEIN")) expectedWeight = 550.0;
        else if (breed.contains("JERSEY")) expectedWeight = 400.0;
        
        double ratio = weight / expectedWeight;
        
        if (ratio < 0.80) return 0.85; // Underweight penalizes potential
        if (ratio < 0.90) return 0.95; 
        if (ratio <= 1.15) return 1.05; // Good/optimal weight boosts potential slightly!
        return 0.95; // Overweight slightly penalizes potential
    }

    public static class MilkPotentialResult {
        private final Integer potential;
        private final String confidence;

        public MilkPotentialResult(Integer potential, String confidence) {
            this.potential = potential;
            this.confidence = confidence;
        }

        public Integer getPotential() { return potential; }
        public String getConfidence() { return confidence; }
    }
}
