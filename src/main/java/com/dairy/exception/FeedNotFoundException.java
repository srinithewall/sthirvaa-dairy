package com.dairy.exception;

public class FeedNotFoundException extends RuntimeException {
    public FeedNotFoundException(Long feedId) {
        super("Feed not found: " + feedId);
    }
}
