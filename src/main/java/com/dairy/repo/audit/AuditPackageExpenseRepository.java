package com.dairy.repo.audit;

import com.dairy.model.audit.AuditPackageExpense;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AuditPackageExpenseRepository extends JpaRepository<AuditPackageExpense, Long> {
    List<AuditPackageExpense> findByPackageIdOrderByDateAscIdAsc(Long packageId);
}
