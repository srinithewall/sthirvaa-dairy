package com.dairy.dto;

import java.time.LocalDate;

/** One animal on the deworming round screen: who it is, its last dose and what is due next. */
public record DewormingRoundRow(
        Long herdId,
        String tagNumber,
        String animalName,
        String animalType,
        String breed,
        String animalStatus,
        String imageUrl,
        String age,
        LocalDate lastDewormedDate,
        LocalDate nextDueDate,
        int dose,
        long daysOverdue,
        boolean due,
        boolean dewormedInRound) {}
