package com.dairy.dto;

import java.time.LocalDate;

/** One open animal reminder (vaccination, deworming, PD check, AI) that is due or overdue. */
public record AnimalReminderRow(
        Long eventId,
        Long herdId,
        String tagNumber,
        String animalName,
        String animalStatus,
        String imageUrl,
        String eventType,
        String title,
        LocalDate dueDate,
        long daysOverdue) {}
