package com.dairy.dto;

/** Outcome of saving the ticked animals: how many were stored and whether the round is clear. */
public record DewormingRoundResult(int savedCount, int stillDueCount, boolean taskCompleted) {}
