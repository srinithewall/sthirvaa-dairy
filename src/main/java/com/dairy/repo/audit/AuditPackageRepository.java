package com.dairy.repo.audit;

import com.dairy.model.audit.AuditPackage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface AuditPackageRepository extends JpaRepository<AuditPackage, Long> {
    Optional<AuditPackage> findByPeriodFrom(LocalDate periodFrom);

    /** Every package without its stored PDF, newest month first. */
    @Query("SELECT p.id, p.periodFrom, p.periodTo, p.documentSavedAt, p.updatedAt FROM AuditPackage p ORDER BY p.periodFrom DESC")
    List<Object[]> listSummaries();
}
