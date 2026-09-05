package com.dairy.exception;

public class PlanNotFoundException extends RuntimeException {
    public PlanNotFoundException(Long planId) {
        super("Feed plan not found: " + planId);
    }

    public PlanNotFoundException(Long planId, Long animalId) {
        super("Feed plan " + planId + " not found for animal " + animalId);
    }
}
