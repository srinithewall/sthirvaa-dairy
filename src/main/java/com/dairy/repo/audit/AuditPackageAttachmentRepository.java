package com.dairy.repo.audit;

import com.dairy.model.audit.AuditPackageAttachment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface AuditPackageAttachmentRepository extends JpaRepository<AuditPackageAttachment, Long> {
    /** id, fileName, contentType, sizeBytes, included, uploadedAt - without the file itself. */
    @Query("SELECT a.id, a.fileName, a.contentType, a.sizeBytes, a.included, a.uploadedAt FROM AuditPackageAttachment a "
        + "WHERE a.packageId = :packageId ORDER BY a.id")
    List<Object[]> listMeta(Long packageId);
}
