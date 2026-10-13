package com.dairy.model.store;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

/** One received lot of an item. Stock on hand = sum of qtyRemaining; sales consume batches FIFO. */
@Entity
@Table(name = "store_stock_batches", indexes = @Index(name = "idx_store_batch_item", columnList = "item_id, qty_remaining"))
@Getter
@Setter
public class StoreStockBatch {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "item_id")
    private StoreItem item;
    @Column(name = "purchase_line_id")
    private Long purchaseLineId;
    @Column(name = "batch_no")
    private String batchNo;
    @Column(name = "qty_received", nullable = false, precision = 12, scale = 3)
    private BigDecimal qtyReceived;
    @Column(name = "qty_remaining", nullable = false, precision = 12, scale = 3)
    private BigDecimal qtyRemaining;
    @Column(name = "unit_cost", nullable = false, precision = 12, scale = 4)
    private BigDecimal unitCost;
    @Column(name = "expiry_date")
    private LocalDate expiryDate;
    @Column(name = "received_date", nullable = false)
    private LocalDate receivedDate;
}
