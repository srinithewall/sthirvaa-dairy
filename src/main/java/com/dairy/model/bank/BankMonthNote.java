package com.dairy.model.bank;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * A note on a month's money in from the bank (Digital Ledger, Received in Bank), e.g. "₹22,900
 * on 5 Oct is the society's payment for September".
 */
@Entity
@Table(name = "bank_month_notes")
@Getter
@Setter
public class BankMonthNote {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** YYYY-MM. */
    @Column(nullable = false, unique = true, length = 7)
    private String month;

    @Column(nullable = false, length = 1000)
    private String note;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "updated_by", length = 100)
    private String updatedBy;

    @PrePersist
    @PreUpdate
    protected void touch() {
        updatedAt = LocalDateTime.now();
    }
}
