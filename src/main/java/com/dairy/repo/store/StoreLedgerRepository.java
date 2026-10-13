package com.dairy.repo.store;

import com.dairy.model.store.StoreLedgerEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;

public interface StoreLedgerRepository extends JpaRepository<StoreLedgerEntry, Long> {

    @Query("SELECT COALESCE(SUM(e.amount), 0) FROM StoreLedgerEntry e WHERE e.farmer.id = :farmerId")
    BigDecimal balance(@Param("farmerId") Long farmerId);

    List<StoreLedgerEntry> findTop50ByFarmerIdOrderByEntryDateDescIdDesc(Long farmerId);

    /** Rows of [farmerId, balance]. */
    @Query("SELECT e.farmer.id, SUM(e.amount) FROM StoreLedgerEntry e GROUP BY e.farmer.id")
    List<Object[]> balances();
}
