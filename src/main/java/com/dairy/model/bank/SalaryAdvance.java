package com.dairy.model.bank;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * One movement on an employee's advance account (Bank screen, Rules, Salary calculation).
 *
 *   GIVEN  - money advanced to them, cut back from their pay over `terms` months from `startMonth`.
 *   REPAID - money they paid back themselves, e.g. clearing the balance early. It lowers what is
 *            owed, so the monthly cuts stop sooner.
 */
@Entity
@Table(name = "salary_advances", indexes = @Index(name = "idx_salary_adv_staff", columnList = "staff_id"))
@Getter
@Setter
public class SalaryAdvance {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "staff_id", nullable = false)
    private Long staffId;

    @Column(name = "entry_date", nullable = false)
    private LocalDate date;

    /** GIVEN or REPAID. */
    @Column(nullable = false, length = 6)
    private String type;

    @Column(nullable = false)
    private Double amount;

    /** GIVEN only: months it is cut back over. */
    private Integer terms;

    /** GIVEN only: YYYY-MM of the first cut. */
    @Column(name = "start_month", length = 7)
    private String startMonth;

    /** CASH or BANK. */
    @Column(length = 4)
    private String mode;

    @Column(length = 255)
    private String note;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "created_by", length = 100)
    private String createdBy;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
