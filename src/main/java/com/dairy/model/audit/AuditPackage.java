package com.dairy.model.audit;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * A month's auditor package: the farm's books for the month laid out for the auditor, with the
 * Kotak statement and any invoices attached. One per month. The figures are worked out from the
 * books when it is opened; what is kept here is what someone chose - the cash expenses, the GST
 * note, the notes - and the last PDF downloaded.
 */
@Entity
@Table(name = "audit_packages")
@Getter
@Setter
public class AuditPackage {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "period_from", nullable = false, unique = true)
    private LocalDate periodFrom;

    @Column(name = "period_to", nullable = false)
    private LocalDate periodTo;

    @Column(name = "include_gst", nullable = false, columnDefinition = "boolean default false")
    private boolean includeGst = false;

    @Column(name = "gst_note", length = 1000)
    private String gstNote;

    @Column(length = 2000)
    private String notes;

    @JsonIgnore
    @Lob
    @Basic(fetch = FetchType.LAZY)
    @Column(name = "document", columnDefinition = "LONGBLOB")
    private byte[] document;

    @Column(name = "document_saved_at")
    private LocalDateTime documentSavedAt;

    @Column(name = "document_saved_by", length = 100)
    private String documentSavedBy;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "created_by", length = 100)
    private String createdBy;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "updated_by", length = 100)
    private String updatedBy;
}
