package com.dairy.exception;

public class RequirementNotFoundException extends RuntimeException {
    public RequirementNotFoundException(String message) {
        super(message);
    }
}
