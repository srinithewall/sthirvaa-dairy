package com.dairy.dto;

import java.time.LocalDate;

/** One ticked animal from the round screen: which animal and the date it was dewormed. */
public record DewormingEntry(Long herdId, LocalDate date) {}
