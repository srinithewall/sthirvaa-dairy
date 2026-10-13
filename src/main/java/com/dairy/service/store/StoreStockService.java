package com.dairy.service.store;

import com.dairy.dto.store.StoreDtos.ExpiringBatch;
import com.dairy.dto.store.StoreDtos.StockAdjustRequest;
import com.dairy.dto.store.StoreDtos.StockRow;
import com.dairy.model.store.*;
import com.dairy.repo.store.StoreItemRepository;
import com.dairy.repo.store.StoreStockBatchRepository;
import com.dairy.repo.store.StoreStockMoveRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;

/** Owns all stock changes: every in/out goes through receive() or consume() so batches and moves stay in sync. */
@Service
public class StoreStockService {

    private final StoreStockBatchRepository batchRepository;
    private final StoreStockMoveRepository moveRepository;
    private final StoreItemRepository itemRepository;

    public StoreStockService(StoreStockBatchRepository batchRepository, StoreStockMoveRepository moveRepository,
                             StoreItemRepository itemRepository) {
        this.batchRepository = batchRepository;
        this.moveRepository = moveRepository;
        this.itemRepository = itemRepository;
    }

    @Transactional
    public StoreStockBatch receive(StoreItem item, BigDecimal qty, BigDecimal unitCost, String batchNo,
                                   LocalDate expiryDate, LocalDate receivedDate, Long purchaseLineId,
                                   StoreMoveType moveType, String refType, Long refId, String reason) {
        requirePositive(qty, "Quantity");
        if (unitCost == null || unitCost.signum() < 0) {
            throw new IllegalArgumentException("Unit cost must be zero or more");
        }
        StoreStockBatch batch = new StoreStockBatch();
        batch.setItem(item);
        batch.setPurchaseLineId(purchaseLineId);
        batch.setBatchNo(batchNo);
        batch.setQtyReceived(qty);
        batch.setQtyRemaining(qty);
        batch.setUnitCost(unitCost);
        batch.setReceivedDate(receivedDate != null ? receivedDate : LocalDate.now());
        batch.setExpiryDate(expiryDate != null ? expiryDate : defaultExpiry(item, batch.getReceivedDate()));
        batch = batchRepository.save(batch);
        recordMove(item.getId(), batch.getId(), moveType, qty, unitCost, refType, refId, reason);
        return batch;
    }

    /**
     * Takes qty out of stock FIFO and returns the total cost of what was taken.
     * Fails if there is not enough stock.
     */
    @Transactional
    public BigDecimal consume(StoreItem item, BigDecimal qty, StoreMoveType moveType,
                              String refType, Long refId, String reason) {
        requirePositive(qty, "Quantity");
        List<StoreStockBatch> batches = batchRepository.lockAvailableFifo(item.getId());
        BigDecimal available = batches.stream().map(StoreStockBatch::getQtyRemaining)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        if (available.compareTo(qty) < 0) {
            throw new IllegalStateException("Not enough stock for " + item.getName()
                    + ": available " + available.stripTrailingZeros().toPlainString()
                    + ", requested " + qty.stripTrailingZeros().toPlainString());
        }
        BigDecimal remaining = qty;
        BigDecimal totalCost = BigDecimal.ZERO;
        for (StoreStockBatch batch : batches) {
            if (remaining.signum() == 0) break;
            BigDecimal take = batch.getQtyRemaining().min(remaining);
            batch.setQtyRemaining(batch.getQtyRemaining().subtract(take));
            remaining = remaining.subtract(take);
            totalCost = totalCost.add(take.multiply(batch.getUnitCost()));
            recordMove(item.getId(), batch.getId(), moveType, take.negate(), batch.getUnitCost(), refType, refId, reason);
        }
        batchRepository.saveAll(batches);
        return totalCost;
    }

    @Transactional
    public void adjust(StockAdjustRequest req) {
        StoreItem item = itemRepository.findById(req.itemId())
                .orElseThrow(() -> new IllegalArgumentException("Item not found"));
        if (req.qty() == null || req.qty().signum() == 0) {
            throw new IllegalArgumentException("Adjustment quantity cannot be zero");
        }
        if (req.reason() == null || req.reason().isBlank()) {
            throw new IllegalArgumentException("Reason is required for a stock adjustment");
        }
        StoreMoveType type = req.type() != null ? req.type() : StoreMoveType.ADJUSTMENT;
        if (type != StoreMoveType.ADJUSTMENT && type != StoreMoveType.EXPIRED && type != StoreMoveType.RETURN) {
            throw new IllegalArgumentException("Adjustment type must be ADJUSTMENT, EXPIRED or RETURN");
        }
        if (req.qty().signum() > 0) {
            BigDecimal cost = req.unitCost();
            if (cost == null) {
                StoreStockBatch last = batchRepository.findFirstByItemIdOrderByReceivedDateDescIdDesc(item.getId());
                if (last == null) {
                    throw new IllegalArgumentException("Unit cost is required: no earlier purchase of this item");
                }
                cost = last.getUnitCost();
            }
            receive(item, req.qty(), cost, null, req.expiryDate(), LocalDate.now(), null,
                    type, "ADJUST", null, req.reason());
        } else {
            consume(item, req.qty().negate(), type, "ADJUST", null, req.reason());
        }
    }

    @Transactional(readOnly = true)
    public List<StockRow> stock(boolean includeInactive) {
        Map<Long, Object[]> summary = new HashMap<>();
        for (Object[] row : batchRepository.stockSummary()) {
            summary.put((Long) row[0], row);
        }
        List<StockRow> rows = new ArrayList<>();
        List<StoreItem> items = includeInactive ? itemRepository.findAllByOrderByNameAsc()
                : itemRepository.findByActiveTrueOrderByNameAsc();
        // Products that have never been received (no supplier bill or adjustment) aren't stock yet.
        Set<Long> everStocked = new HashSet<>(batchRepository.stockedItemIds());
        for (StoreItem item : items) {
            if (!everStocked.contains(item.getId())) continue;
            Object[] s = summary.get(item.getId());
            BigDecimal qty = s != null ? (BigDecimal) s[1] : BigDecimal.ZERO;
            BigDecimal value = s != null ? ((BigDecimal) s[2]).setScale(2, java.math.RoundingMode.HALF_UP) : BigDecimal.ZERO;
            LocalDate expiry = s != null ? (LocalDate) s[3] : null;
            BigDecimal reorder = item.getReorderLevel() != null ? item.getReorderLevel() : BigDecimal.ZERO;
            boolean low = item.isActive() && qty.compareTo(reorder) <= 0;
            rows.add(new StockRow(item, qty, value, expiry, low));
        }
        return rows;
    }

    @Transactional(readOnly = true)
    public List<ExpiringBatch> expiring(int days) {
        LocalDate today = LocalDate.now();
        return batchRepository.findExpiringBefore(today.plusDays(days)).stream()
                .map(b -> new ExpiringBatch(b.getId(), b.getItem().getId(), b.getItem().getName(), b.getBatchNo(),
                        b.getQtyRemaining(), b.getExpiryDate(), ChronoUnit.DAYS.between(today, b.getExpiryDate())))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<StoreStockMove> moves(Long itemId) {
        return moveRepository.findTop200ByItemIdOrderByMovedAtDescIdDesc(itemId);
    }

    /**
     * Empties the batch received for a purchase line, for editing that purchase. Fails if any of
     * it has already left the batch (sold, transferred, adjusted), since that history can't be redone.
     */
    public void reversePurchaseLine(Long purchaseLineId, String itemName, Long purchaseId) {
        reversePurchaseLine(purchaseLineId, itemName, purchaseId, false);
    }

    /** deleting: the bill is being deleted rather than edited (changes the message and history note). */
    public void reversePurchaseLine(Long purchaseLineId, String itemName, Long purchaseId, boolean deleting) {
        StoreStockBatch batch = batchRepository.findFirstByPurchaseLineId(purchaseLineId);
        if (batch == null) return;
        if (batch.getQtyRemaining().compareTo(batch.getQtyReceived()) != 0) {
            throw new IllegalArgumentException(itemName + " from this bill is already sold or moved, so the bill can't be "
                    + (deleting ? "deleted." : "edited.") + " Use Stock → Adjust to correct it.");
        }
        BigDecimal qty = batch.getQtyRemaining();
        batch.setQtyRemaining(BigDecimal.ZERO);
        if (deleting) batch.setPurchaseLineId(null);
        batchRepository.save(batch);
        recordMove(batch.getItem().getId(), batch.getId(), StoreMoveType.PURCHASE, qty.negate(), batch.getUnitCost(),
                "PURCHASE", purchaseId, deleting ? "Purchase deleted" : "Purchase edited");
    }

    public StoreStockBatch purchaseBatch(Long purchaseLineId) {
        return batchRepository.findFirstByPurchaseLineId(purchaseLineId);
    }

    /**
     * Admin edit of a purchase line whose stock is partly used: keeps the batch (so past sales stay
     * linked), moves it to the new line, and applies the quantity difference plus new cost/expiry.
     * Sales already made keep the cost they were billed at.
     */
    public void updatePurchaseBatch(StoreStockBatch batch, StorePurchaseLine line, LocalDate receivedDate, Long purchaseId) {
        BigDecimal delta = line.getQty().subtract(batch.getQtyReceived());
        batch.setPurchaseLineId(line.getId());
        batch.setQtyReceived(line.getQty());
        batch.setQtyRemaining(batch.getQtyRemaining().add(delta));
        batch.setUnitCost(line.getUnitCost());
        batch.setBatchNo(line.getBatchNo());
        batch.setReceivedDate(receivedDate);
        batch.setExpiryDate(line.getExpiryDate() != null ? line.getExpiryDate() : defaultExpiry(line.getItem(), receivedDate));
        batchRepository.save(batch);
        if (delta.signum() != 0) {
            recordMove(line.getItem().getId(), batch.getId(), StoreMoveType.PURCHASE, delta, line.getUnitCost(),
                    "PURCHASE", purchaseId, "Purchase edited");
        }
    }

    private void recordMove(Long itemId, Long batchId, StoreMoveType type, BigDecimal qty, BigDecimal unitCost,
                            String refType, Long refId, String reason) {
        StoreStockMove move = new StoreStockMove();
        move.setItemId(itemId);
        move.setBatchId(batchId);
        move.setMoveType(type);
        move.setQty(qty);
        move.setUnitCost(unitCost);
        move.setRefType(refType);
        move.setRefId(refId);
        move.setReason(reason);
        move.setMovedAt(LocalDateTime.now());
        move.setMovedBy(StoreSecurity.currentUser());
        moveRepository.save(move);
    }

    private static LocalDate defaultExpiry(StoreItem item, LocalDate received) {
        return item.getShelfLifeDays() != null ? received.plusDays(item.getShelfLifeDays()) : null;
    }

    static void requirePositive(BigDecimal value, String field) {
        if (value == null || value.signum() <= 0) {
            throw new IllegalArgumentException(field + " must be greater than zero");
        }
    }
}
