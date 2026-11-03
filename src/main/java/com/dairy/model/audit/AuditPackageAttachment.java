package com.dairy.model.audit;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/** An invoice (PDF or photo) kept with a package; in the PDF only when included is ticked. */
@Entity
@Table(name = "audit_package_attachments", indexes = @Index(name = "idx_audit_att_pkg", columnList = "package_id"))
@Getter
@Setter
public class AuditPackageAttachment {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "package_id", nullable = false)
    private Long packageId;

    @Column(name = "file_name", length = 200)
    private String fileName;

    @Column(name = "content_type", length = 100)
    private String contentType;

    @Column(name = "size_bytes")
    private Integer sizeBytes;

    @Column(nullable = false, columnDefinition = "boolean default true")
    private boolean included = true;

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
