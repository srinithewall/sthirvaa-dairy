package com.dairy.repo.store;

import com.dairy.model.store.StoreRewardEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface StoreRewardRepository extends JpaRepository<StoreRewardEntry, Long> {

    @Query("SELECT COALESCE(SUM(e.coins), 0) FROM StoreRewardEntry e WHERE e.farmer.id = :farmerId")
    long balance(@Param("farmerId") Long farmerId);

    /** Rows of [farmerId, coins]. */
    @Query("SELECT e.farmer.id, SUM(e.coins) FROM StoreRewardEntry e GROUP BY e.farmer.id")
    List<Object[]> balances();

    List<StoreRewardEntry> findTop50ByFarmerIdOrderByEntryDateDescIdDesc(Long farmerId);

    void deleteBySaleId(Long saleId);
}
