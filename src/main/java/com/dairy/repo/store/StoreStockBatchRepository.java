package com.dairy.repo.store;

import com.dairy.model.store.StoreStockBatch;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface StoreStockBatchRepository extends JpaRepository<StoreStockBatch, Long> {

    /** Batches with stock left, in FIFO order (earliest expiry first, undated last), locked for update. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT b FROM StoreStockBatch b WHERE b.item.id = :itemId AND b.qtyRemaining > 0 "
            + "ORDER BY CASE WHEN b.expiryDate IS NULL THEN 1 ELSE 0 END, b.expiryDate, b.receivedDate, b.id")
    List<StoreStockBatch> lockAvailableFifo(@Param("itemId") Long itemId);

    /** Rows of [itemId, qtyOnHand, stockValueAtCost, earliestExpiry]. */
    @Query("SELECT b.item.id, SUM(b.qtyRemaining), SUM(b.qtyRemaining * b.unitCost), MIN(b.expiryDate) "
            + "FROM StoreStockBatch b WHERE b.qtyRemaining > 0 GROUP BY b.item.id")
    List<Object[]> stockSummary();

    @Query("SELECT b FROM StoreStockBatch b WHERE b.qtyRemaining > 0 AND b.expiryDate IS NOT NULL "
            + "AND b.expiryDate <= :before ORDER BY b.expiryDate")
    List<StoreStockBatch> findExpiringBefore(@Param("before") LocalDate before);

    StoreStockBatch findFirstByItemIdOrderByReceivedDateDescIdDesc(Long itemId);

    /** Items that have ever had stock received. */
    @Query("SELECT DISTINCT b.item.id FROM StoreStockBatch b")
    List<Long> stockedItemIds();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    StoreStockBatch findFirstByPurchaseLineId(Long purchaseLineId);
}
