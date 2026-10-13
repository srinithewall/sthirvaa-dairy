package com.dairy.model.store;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** Append-only audit trail of every stock change. */
@Entity
@Table(name = "store_stock_moves", indexes = @Index(name = "idx_store_move_item", columnList = "item_id, moved_at"))
@Getter
@Setter
public class StoreStockMove {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "item_id", nullable = false)
    private Long itemId;
    @Column(name = "batch_id")
    private Long batchId;
    @Enumerated(EnumType.STRING)
    @Column(name = "move_type", nullable = false, length = 20)
    private StoreMoveType moveType;
    /** Positive = stock in, negative = stock out. */
    @Column(nullable = false, precision = 12, scale = 3)
    private BigDecimal qty;
    @Column(name = "unit_cost", nullable = false, precision = 12, scale = 4)
    private BigDecimal unitCost;
    @Column(name = "ref_type", length = 20)
    private String refType;
    @Column(name = "ref_id")
    private Long refId;
    private String reason;
    @Column(name = "moved_at", nullable = false)
    private LocalDateTime movedAt;
    @Column(name = "moved_by")
    private String movedBy;
}
