package com.dairy.model.bank;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Learned from the review screen: "money going to RAMESH FEEDS is a Feed expense".
 * New bank lines whose narration contains the pattern are mapped without asking.
 */
@Entity
@Table(name = "bank_rules")
@Getter
@Setter
public class BankRule {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Upper case. Matched as a substring of the narration. */
    @Column(nullable = false, length = 120)
    private String pattern;

    /** CREDIT or DEBIT. */
    @Column(nullable = false, length = 6)
    private String direction;

    /** EXPENSE, INCOME, SETTLEMENT or IGNORE. */
    @Column(nullable = false, length = 10)
    private String kind;

    @Column(length = 100)
    private String category;

    @Column(length = 10)
    private String segment;

    private int hits;

    @Column(name = "last_used")
    private LocalDateTime lastUsed;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "created_by", length = 100)
    private String createdBy;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
