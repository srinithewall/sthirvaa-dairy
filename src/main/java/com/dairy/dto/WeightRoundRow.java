package com.dairy.dto;

import com.dairy.model.HerdWeightRecord;

import java.time.LocalDate;

/**
 * One animal as it appears on the herd weight round screen: who it is, what it last weighed,
 * and whether it has already been measured in the current round.
 */
public class WeightRoundRow {

    private Long herdId;
    private String tagNumber;
    private String animalName;
    private String animalType;
    private String breed;
    private String animalStatus;
    private String imageUrl;

    private Double lastWeightKg;
    private LocalDate lastRecordDate;
    private Double lastHeartGirthCm;
    private Double lastBodyLengthCm;
    private Integer daysSinceLastRecord;
    private Double lastWeightChangeKg;

    /** True when this animal already has a reading dated on the round's date. */
    private boolean measuredInRound;

    public WeightRoundRow() {}

    public static WeightRoundRow of(com.dairy.model.Herd herd, HerdWeightRecord last, LocalDate roundDate) {
        WeightRoundRow row = new WeightRoundRow();
        row.herdId = herd.getId();
        row.tagNumber = herd.getTagNumber();
        row.animalName = herd.getAnimalName();
        row.animalType = herd.getAnimalType();
        row.breed = herd.getBreed();
        row.animalStatus = herd.getAnimalStatus();
        row.imageUrl = herd.getImageUrl();

        if (last != null) {
            row.lastWeightKg = last.getWeightKg();
            row.lastRecordDate = last.getRecordDate();
            row.lastHeartGirthCm = last.getHeartGirthCm();
            row.lastBodyLengthCm = last.getBodyLengthCm();
            row.lastWeightChangeKg = last.getWeightChangeKg();
            if (last.getRecordDate() != null) {
                row.daysSinceLastRecord = (int) java.time.temporal.ChronoUnit.DAYS
                        .between(last.getRecordDate(), roundDate);
                row.measuredInRound = !last.getRecordDate().isBefore(roundDate);
            }
        }
        return row;
    }

    public Long getHerdId() { return herdId; }
    public void setHerdId(Long herdId) { this.herdId = herdId; }

    public String getTagNumber() { return tagNumber; }
    public void setTagNumber(String tagNumber) { this.tagNumber = tagNumber; }

    public String getAnimalName() { return animalName; }
    public void setAnimalName(String animalName) { this.animalName = animalName; }

    public String getAnimalType() { return animalType; }
    public void setAnimalType(String animalType) { this.animalType = animalType; }

    public String getBreed() { return breed; }
    public void setBreed(String breed) { this.breed = breed; }

    public String getAnimalStatus() { return animalStatus; }
    public void setAnimalStatus(String animalStatus) { this.animalStatus = animalStatus; }

    public String getImageUrl() { return imageUrl; }
    public void setImageUrl(String imageUrl) { this.imageUrl = imageUrl; }

    public Double getLastWeightKg() { return lastWeightKg; }
    public void setLastWeightKg(Double lastWeightKg) { this.lastWeightKg = lastWeightKg; }

    public LocalDate getLastRecordDate() { return lastRecordDate; }
    public void setLastRecordDate(LocalDate lastRecordDate) { this.lastRecordDate = lastRecordDate; }

    public Double getLastHeartGirthCm() { return lastHeartGirthCm; }
    public void setLastHeartGirthCm(Double lastHeartGirthCm) { this.lastHeartGirthCm = lastHeartGirthCm; }

    public Double getLastBodyLengthCm() { return lastBodyLengthCm; }
    public void setLastBodyLengthCm(Double lastBodyLengthCm) { this.lastBodyLengthCm = lastBodyLengthCm; }

    public Integer getDaysSinceLastRecord() { return daysSinceLastRecord; }
    public void setDaysSinceLastRecord(Integer daysSinceLastRecord) { this.daysSinceLastRecord = daysSinceLastRecord; }

    public Double getLastWeightChangeKg() { return lastWeightChangeKg; }
    public void setLastWeightChangeKg(Double lastWeightChangeKg) { this.lastWeightChangeKg = lastWeightChangeKg; }

    public boolean isMeasuredInRound() { return measuredInRound; }
    public void setMeasuredInRound(boolean measuredInRound) { this.measuredInRound = measuredInRound; }
}
