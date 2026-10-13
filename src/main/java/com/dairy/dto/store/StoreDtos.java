package com.dairy.dto.store;

import com.dairy.model.store.StoreFarmer;
import com.dairy.model.store.StoreItem;
import com.dairy.model.store.StoreLedgerEntry;
import com.dairy.model.store.StoreMoveType;
import com.dairy.model.store.StorePaymentMode;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/** Request/response shapes for the Feed Store API. */
public final class StoreDtos {
    private StoreDtos() {}

    /**
     * itemId for an existing item, or newItem (name, brand, category, unit, unitSize, …) to create one
     * from the bill. salePrice, if given, becomes the item's selling price (cost + margin).
     */
    public record PurchaseLineRequest(Long itemId, StoreItem newItem, BigDecimal qty, BigDecimal unitCost,
                                      BigDecimal salePrice, String batchNo, LocalDate expiryDate) {}

    public record PurchaseRequest(Long supplierId, String billNo, LocalDate purchaseDate,
                                  BigDecimal paid, String notes, List<PurchaseLineRequest> lines) {}

    public record SaleLineRequest(Long itemId, BigDecimal qty, BigDecimal unitPrice) {}

    public record SaleRequest(LocalDate saleDate, Long farmerId, String customerName, String customerPhone,
                              BigDecimal discount, StorePaymentMode paymentMode, BigDecimal paidAmount,
                              String notes, List<SaleLineRequest> lines) {}

    /** qty > 0 adds stock (unitCost optional, defaults to last cost); qty < 0 removes it FIFO. */
    public record StockAdjustRequest(Long itemId, BigDecimal qty, StoreMoveType type,
                                     BigDecimal unitCost, LocalDate expiryDate, String reason) {}

    public record StockRow(StoreItem item, BigDecimal qtyOnHand, BigDecimal stockValue,
                           LocalDate earliestExpiry, boolean lowStock) {}

    public record ExpiringBatch(Long batchId, Long itemId, String itemName, String batchNo,
                                BigDecimal qtyRemaining, LocalDate expiryDate, long daysLeft) {}

    public record PaymentRequest(BigDecimal amount, StorePaymentMode paymentMode, LocalDate date, String notes) {}

    /** balance > 0: farmer owes the shop. */
    public record FarmerAccount(StoreFarmer farmer, BigDecimal balance, LocalDate lastVisit,
                                List<StoreLedgerEntry> entries) {}

    /** One row of the farmer accounts list. */
    public record FarmerSummary(StoreFarmer farmer, BigDecimal balance, LocalDate lastVisit) {}

    public record Dashboard(LocalDate date, int billCount, BigDecimal salesTotal, BigDecimal grossMargin,
                            Map<StorePaymentMode, BigDecimal> byPaymentMode, BigDecimal monthSales,
                            BigDecimal monthMargin, BigDecimal stockValue, List<StockRow> lowStock,
                            List<ExpiringBatch> expiring) {}
}
