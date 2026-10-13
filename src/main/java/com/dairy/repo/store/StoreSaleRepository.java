package com.dairy.repo.store;

import com.dairy.model.store.StoreSale;
import com.dairy.model.store.StoreSaleType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface StoreSaleRepository extends JpaRepository<StoreSale, Long> {
    List<StoreSale> findBySaleDateBetweenOrderBySaleDateDescIdDesc(LocalDate from, LocalDate to);
    List<StoreSale> findBySaleDateBetweenAndTypeOrderBySaleDateDescIdDesc(LocalDate from, LocalDate to, StoreSaleType type);

    StoreSale findFirstByFarmerIdOrderBySaleDateDescIdDesc(Long farmerId);

    /** Rows of [farmerId, last sale date]. */
    @org.springframework.data.jpa.repository.Query(
            "SELECT s.farmer.id, MAX(s.saleDate) FROM StoreSale s WHERE s.farmer IS NOT NULL GROUP BY s.farmer.id")
    List<Object[]> lastVisits();
}
