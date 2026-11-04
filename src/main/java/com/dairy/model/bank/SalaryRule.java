package com.dairy.model.bank;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * How one employee's monthly pay is worked out (Bank screen, Rules, Salary calculation).
 *
 *   FIXED   - fixedAmount every month.
 *   DYNAMIC - sharePercent of the month's dairy profit: milk payments received in the bank minus
 *             the cattle expenses in the ledger, e.g. 50% for a partner who shares the profit.
 *
 * Either way an advance is paid back in equal monthly cuts: advanceAmount / advanceTerms,
 * from advanceStartMonth for advanceTerms months.
 */
@Entity
@Table(name = "salary_rules")
@Getter
@Setter
public class SalaryRule {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "staff_id", nullable = false, unique = true)
    private Long staffId;

    /** FIXED or DYNAMIC. */
    @Column(nullable = false, length = 10)
    private String type;

    @Column(name = "fixed_amount")
    private Double fixedAmount;

    @Column(name = "share_percent")
    private Double sharePercent;

    /**
     * The salary the audit report shows every month, whatever the rule works out to (e.g. a fixed
     * 20,000 for a profit-sharing partner). Blank keeps the employee out of the audit's salaries.
     */
    @Column(name = "audit_amount")
    private Double auditAmount;

    /** Words of their name in bank narrations (e.g. LOKESH G): their bank lines typed Salary pay the audit salary. */
    @Column(name = "bank_name", length = 120)
    private String bankName;

    /** No longer used: advances are kept in SalaryAdvance. Read once to move old rules across. */
    @Column(name = "advance_amount")
    private Double advanceAmount;

    /** Months the advance is cut over. */
    @Column(name = "advance_terms")
    private Integer advanceTerms;

    /** YYYY-MM of the first cut. */
    @Column(name = "advance_start_month", length = 7)
    private String advanceStartMonth;

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
