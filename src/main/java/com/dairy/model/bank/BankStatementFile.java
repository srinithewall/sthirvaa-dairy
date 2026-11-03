package com.dairy.model.bank;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * The bank's own PDF statement for a period, kept as uploaded so the sales/purchase report can be
 * downloaded with it attached. Kept in the database, not public file storage: it is bank data.
 * One file per period; uploading the same period again replaces it.
 */
@Entity
@Table(name = "bank_statement_files")
@Getter
@Setter
public class BankStatementFile {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "period_from", nullable = false)
    private LocalDate periodFrom;

    @Column(name = "period_to", nullable = false)
    private LocalDate periodTo;

    @Column(name = "account_last4", length = 4)
    private String accountLast4;

    @Column(name = "file_name", length = 200)
    private String fileName;

    private Integer pages;

    @Column(name = "size_bytes")
    private Integer sizeBytes;

    @JsonIgnore
    @Lob
    @Basic(fetch = FetchType.LAZY)
    @Column(nullable = false, columnDefinition = "LONGBLOB")
    private byte[] content;

    @Column(name = "uploaded_at")
    private LocalDateTime uploadedAt;

    @Column(name = "uploaded_by", length = 100)
    private String uploadedBy;
}
