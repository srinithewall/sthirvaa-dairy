package com.dairy.dto;

import java.time.LocalDate;

/**
 * One animal on the herd weight overview (Analytics & Reports): its current weight, the weight
 * it should be at for its breed and age, how far off it is, and its latest body condition score.
 */
public class HerdWeightOverviewRow {

    private Long herdId;
    private String tagNumber;
    private String animalName;
    private String breed;
    private String animalStatus;
    private Integer ageMonths;
    private java.time.LocalDate birthDate;
    /** Days in milk since the last calving; null when she has not calved. */
    private Integer dim;

    /** Latest reading; null when the animal has never been weighed or taped. */
    private Double currentWeightKg;
    private LocalDate weightDate;
    /** SCALE, HEART_GIRTH_TAPE, or GIRTH_ESTIMATE when only the herd's stored girth is known. */
    private String weightMethod;

    private Double targetWeightKg;
    /** Target minus current: positive = kg still missing, negative = kg above target. */
    private Double gapKg;
    private String targetBasis;
    /** Breed/age figure (pregnancy included). */
    private Double breedTargetKg;
    /** Her own weight brought to BCS 3 (pregnancy included); null without a weight and a BCS. */
    private Double frameTargetKg;
    /** Her fixed base minimum (BCS 3, open); null for young stock and cows not yet scored. */
    private Double baseMinWeightKg;
    private java.time.LocalDate baseMinWeightDate;
    /** true = set by hand; false = the app's suggestion. */
    private Boolean baseManual;
    /** What her latest BCS says she should weigh on the weighing day (base moved by BCS, plus the calf). */
    private Double expectedAtBcsKg;
    /** Latest weight against that, in % (+ heavier, - lighter); outside +/-5% the weight and BCS disagree. */
    private Double bcsMatchPct;

    // Base check (see BaseCheck): OK, LOW (base under what the data says) or HIGH; null = no data.
    /** Her latest heart girth (every animal) and, for grown cows, the base it suggests next to the herd. */
    private Double girthCm;
    private java.time.LocalDate girthDate;
    private Double girthBaseKg;
    private String girthCheck;
    /** Days pregnant when the girth was taken, when that was late enough (6+ months) for it not to be used. */
    private Integer girthPregnantDays;
    /** Her breed's range from the breed table (not checked for an unknown breed). */
    private Double breedLowKg;
    private Double breedHighKg;
    private String breedCheck;
    /** Pregnancy weight included in the target (0 when open). */
    private Double pregnancyKg;
    private Integer daysPregnant;
    /**
     * SHORT (below the minimum healthy weight), HEALTHY (grown cow at or above it with a BCS of 3.5
     * or more), LOW_BCS (grown cow at or above it but scored under 3.5, or not scored), AHEAD (young
     * stock at or above the growth curve), OVER_CONDITIONED (BCS 4 or more - only body condition
     * calls an animal fat, never weight), or null when there is no weight or no target.
     */
    private String verdict;

    private Double bcs;
    private LocalDate bcsDate;
    private String bcsLabel;

    public Long getHerdId() { return herdId; }
    public void setHerdId(Long herdId) { this.herdId = herdId; }

    public String getTagNumber() { return tagNumber; }
    public void setTagNumber(String tagNumber) { this.tagNumber = tagNumber; }

    public String getAnimalName() { return animalName; }
    public void setAnimalName(String animalName) { this.animalName = animalName; }

    public String getBreed() { return breed; }
    public void setBreed(String breed) { this.breed = breed; }

    public String getAnimalStatus() { return animalStatus; }
    public void setAnimalStatus(String animalStatus) { this.animalStatus = animalStatus; }

    public java.time.LocalDate getBirthDate() { return birthDate; }
    public void setBirthDate(java.time.LocalDate birthDate) { this.birthDate = birthDate; }

    public Integer getDim() { return dim; }
    public void setDim(Integer dim) { this.dim = dim; }

    public Integer getAgeMonths() { return ageMonths; }
    public void setAgeMonths(Integer ageMonths) { this.ageMonths = ageMonths; }

    public Double getCurrentWeightKg() { return currentWeightKg; }
    public void setCurrentWeightKg(Double currentWeightKg) { this.currentWeightKg = currentWeightKg; }

    public LocalDate getWeightDate() { return weightDate; }
    public void setWeightDate(LocalDate weightDate) { this.weightDate = weightDate; }

    public String getWeightMethod() { return weightMethod; }
    public void setWeightMethod(String weightMethod) { this.weightMethod = weightMethod; }

    public Double getTargetWeightKg() { return targetWeightKg; }
    public void setTargetWeightKg(Double targetWeightKg) { this.targetWeightKg = targetWeightKg; }

    public Double getGapKg() { return gapKg; }
    public void setGapKg(Double gapKg) { this.gapKg = gapKg; }

    public String getTargetBasis() { return targetBasis; }
    public void setTargetBasis(String targetBasis) { this.targetBasis = targetBasis; }

    public Double getBreedTargetKg() { return breedTargetKg; }
    public void setBreedTargetKg(Double breedTargetKg) { this.breedTargetKg = breedTargetKg; }

    public Double getFrameTargetKg() { return frameTargetKg; }
    public void setFrameTargetKg(Double frameTargetKg) { this.frameTargetKg = frameTargetKg; }
    public Double getBaseMinWeightKg() { return baseMinWeightKg; }
    public void setBaseMinWeightKg(Double baseMinWeightKg) { this.baseMinWeightKg = baseMinWeightKg; }
    public java.time.LocalDate getBaseMinWeightDate() { return baseMinWeightDate; }
    public void setBaseMinWeightDate(java.time.LocalDate baseMinWeightDate) { this.baseMinWeightDate = baseMinWeightDate; }
    public Boolean getBaseManual() { return baseManual; }
    public void setBaseManual(Boolean baseManual) { this.baseManual = baseManual; }
    public Double getExpectedAtBcsKg() { return expectedAtBcsKg; }
    public void setExpectedAtBcsKg(Double expectedAtBcsKg) { this.expectedAtBcsKg = expectedAtBcsKg; }
    public Double getBcsMatchPct() { return bcsMatchPct; }
    public void setBcsMatchPct(Double bcsMatchPct) { this.bcsMatchPct = bcsMatchPct; }
    public Double getGirthCm() { return girthCm; }
    public void setGirthCm(Double v) { this.girthCm = v; }
    public java.time.LocalDate getGirthDate() { return girthDate; }
    public void setGirthDate(java.time.LocalDate v) { this.girthDate = v; }
    public Double getGirthBaseKg() { return girthBaseKg; }
    public void setGirthBaseKg(Double v) { this.girthBaseKg = v; }
    public String getGirthCheck() { return girthCheck; }
    public void setGirthCheck(String v) { this.girthCheck = v; }
    public Integer getGirthPregnantDays() { return girthPregnantDays; }
    public void setGirthPregnantDays(Integer v) { this.girthPregnantDays = v; }
    public Double getBreedLowKg() { return breedLowKg; }
    public void setBreedLowKg(Double v) { this.breedLowKg = v; }
    public Double getBreedHighKg() { return breedHighKg; }
    public void setBreedHighKg(Double v) { this.breedHighKg = v; }
    public String getBreedCheck() { return breedCheck; }
    public void setBreedCheck(String v) { this.breedCheck = v; }

    public Double getPregnancyKg() { return pregnancyKg; }
    public void setPregnancyKg(Double pregnancyKg) { this.pregnancyKg = pregnancyKg; }

    public Integer getDaysPregnant() { return daysPregnant; }
    public void setDaysPregnant(Integer daysPregnant) { this.daysPregnant = daysPregnant; }

    public String getVerdict() { return verdict; }
    public void setVerdict(String verdict) { this.verdict = verdict; }

    public Double getBcs() { return bcs; }
    public void setBcs(Double bcs) { this.bcs = bcs; }

    public LocalDate getBcsDate() { return bcsDate; }
    public void setBcsDate(LocalDate bcsDate) { this.bcsDate = bcsDate; }

    public String getBcsLabel() { return bcsLabel; }
    public void setBcsLabel(String bcsLabel) { this.bcsLabel = bcsLabel; }
}
