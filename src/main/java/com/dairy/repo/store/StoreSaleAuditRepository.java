package com.dairy.repo.store;

import com.dairy.model.store.StoreSaleAudit;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface StoreSaleAuditRepository extends JpaRepository<StoreSaleAudit, Long> {
    List<StoreSaleAudit> findBySaleIdOrderByIdDesc(Long saleId);

    List<StoreSaleAudit> findByActionAndCreatedAtBetweenOrderByIdDesc(String action, LocalDateTime from, LocalDateTime to);
}
