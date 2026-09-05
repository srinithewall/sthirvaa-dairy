package com.dairy.exception;

public class AnimalNotFoundException extends RuntimeException {
    public AnimalNotFoundException(Long animalId) {
        super("Animal not found: " + animalId);
    }
}
