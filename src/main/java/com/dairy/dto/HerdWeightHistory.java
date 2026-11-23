package com.dairy.dto;

import java.time.LocalDate;
import java.util.List;

/**
 * One animal's weight history for Analytics & Reports: every reading oldest first, each with the
 * healthy weight it should have been at on that day, plus the animal's milk by month over the
 * same span so the two can be read on one chart.
 */
public record HerdWeightHistory(
        Long herdId,
        String tagNumber,
        String animalName,
        String breed,
        String animalStatus,
        List<Reading> readings,
        List<MilkMonth> milk) {

    /**
     * @param weightKg     the reading, rounded to the kg
     * @param method       SCALE or HEART_GIRTH_TAPE
     * @param bcs          body condition score in force that day (see {@code bcsDate}); null if never scored
     * @param bcsDate      when that score was given
     * @param changeKg     against the previous reading; null for the first
     * @param days         days since the previous reading; null for the first
     * @param gainGPerDay  average daily gain since the previous reading, g/day; null for the first
     *                     or when both were taken the same day
     * @param targetKg     minimum healthy weight on that day (age, frame, pregnancy as they were then)
     * @param gapKg        target minus weight: positive = kg still missing
     * @param targetBasis  how the target was worked out
     * @param ageMonths    age on that day; null without a birth date
     * @param daysPregnant days pregnant on that day; null when open
     */
    public record Reading(
            Long id,
            LocalDate date,
            Double weightKg,
            String method,
            Double heartGirthCm,
            Double bcs,
            LocalDate bcsDate,
            Double changeKg,
            Integer days,
            Integer gainGPerDay,
            Double targetKg,
            Double gapKg,
            String targetBasis,
            Integer ageMonths,
            Integer daysPregnant,
            String notes) {}

    /**
     * @param month       first day of the month
     * @param litres      total for the month, rounded
     * @param daysMilked  days with a milk record
     * @param avgPerDay   litres per milked day, one decimal
     */
    public record MilkMonth(LocalDate month, Double litres, Integer daysMilked, Double avgPerDay) {}
}
