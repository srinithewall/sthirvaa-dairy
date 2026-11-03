package com.dairy.model.bank;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * One line of the farm's Kotak current account statement, fetched by BankFeedService.
 *
 * status says how far it has been accounted for:
 *   UNMAPPED  - nothing known yet, waiting for someone to pick a category
 *   SUGGESTED - a guess (narration keyword or a near ledger match) waiting for approval
 *   MAPPED    - accounted for, see kind
 *   IGNORED   - not business money (own-account transfers, reversals)
 *
 * kind (SUGGESTED / MAPPED) says where the money is booked:
 *   EXPENSE / INCOME - booked on the bank side only; the Digital Ledger is never written from
 *                      here. ledgerId is set when the line pays an entry staff already made in
 *                      the ledger (posted = true only on lines from before that rule)
 *   SETTLEMENT       - money for entries the app already books another way, e.g. the society's
 *                      milk payment for the daily MILK_SALES income from AMCS. No ledger entry,
 *                      otherwise the same money would be counted twice.
 */
@Entity
@Table(name = "bank_transactions", indexes = {
    @Index(name = "idx_bank_txn_date", columnList = "txn_date"),
    @Index(name = "idx_bank_txn_status", columnList = "status")
})
@Getter
@Setter
public class BankTransaction {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Bank reference, or a hash of the line when the bank sends none. Stops re-fetches duplicating. */
    @Column(name = "dedupe_key", nullable = false, unique = true, length = 191)
    private String dedupeKey;

    @Column(name = "bank_ref", length = 100)
    private String bankRef;

    @Column(name = "account_last4", length = 4)
    private String accountLast4;

    @Column(name = "txn_date", nullable = false)
    private LocalDate txnDate;

    @Column(length = 500)
    private String narration;

    /** Always positive; direction says which way it went. */
    @Column(nullable = false)
    private Double amount;

    /** CREDIT (money in) or DEBIT (money out). */
    @Column(nullable = false, length = 6)
    private String direction;

    private Double balance;

    /** UPI, NEFT, IMPS, RTGS, CHEQUE, CASH, CARD, CHARGES or OTHER - read from the narration. */
    @Column(length = 10)
    private String mode;

    /** Who paid or was paid, read from the narration. What learned rules match on. */
    @Column(length = 120)
    private String counterparty;

    @Column(nullable = false, length = 10)
    private String status = "UNMAPPED";

    @Column(length = 10)
    private String kind;

    @Column(length = 100)
    private String category;

    /** CATTLE or POULTRY, as on the ledger. */
    @Column(length = 10)
    private String segment;

    @Column(length = 255)
    private String note;

    @Column(name = "ledger_id")
    private Long ledgerId;

    @Column(nullable = false, columnDefinition = "boolean default false")
    private boolean posted = false;

    @Column(name = "rule_id")
    private Long ruleId;

    /** Why it was mapped the way it was, shown on the review screen. */
    @Column(name = "match_reason", length = 160)
    private String matchReason;

    @Column(name = "fetched_at")
    private LocalDateTime fetchedAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "updated_by", length = 100)
    private String updatedBy;

    /** Set when an employee rule matches this line (that rule's name); not stored. */
    @Transient
    private String employee;

    @PrePersist
    protected void onCreate() {
        fetchedAt = LocalDateTime.now();
        updatedAt = fetchedAt;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
