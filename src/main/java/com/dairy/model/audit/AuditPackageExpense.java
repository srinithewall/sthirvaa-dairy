package com.dairy.model.audit;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

/**
 * A cash expense in a package's purchase register: copied from the Digital Ledger (ledgerExpenseId
 * set) or typed in for the package only. Removing one keeps the row with excluded = true, so it
 * can be put back and is not re-added the next time the ledger is checked for new cash expenses.
 */
@Entity
@Table(name = "audit_package_expenses", indexes = @Index(name = "idx_audit_exp_pkg", columnList = "package_id"))
@Getter
@Setter
public class AuditPackageExpense {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "package_id", nullable = false)
    private Long packageId;

    @Column(name = "ledger_expense_id")
    private Long ledgerExpenseId;

    @Column(name = "expense_date", nullable = false)
    private LocalDate date;

    @Column(length = 100)
    private String category;

    @Column(length = 255)
    private String description;

    @Column(nullable = false)
    private Double amount;

    @Column(name = "paid_by", length = 100)
    private String paidBy;

    @Column(length = 10)
    private String segment;

    @Column(nullable = false, columnDefinition = "boolean default false")
    private boolean excluded = false;

    /** Entered by hand in the app, so someone checks it before the package goes out. */
    @Column(nullable = false, columnDefinition = "boolean default false")
    private boolean reviewed = false;

    @Column(name = "reviewed_by", length = 100)
    private String reviewedBy;

    /** Changed in the package; the Digital Ledger entry it came from is left as it was. */
    @Column(nullable = false, columnDefinition = "boolean default false")
    private boolean edited = false;
}
