package com.dairy.model.store;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

/**
 * One row per change to a bill: created, edited or deleted, by whom and when. snapshot is the bill as
 * it was before an edit or delete (JSON), so an older version can be looked at or put back.
 */
@Entity
@Table(name = "store_sale_audit", indexes = @Index(name = "idx_store_sale_audit_sale", columnList = "sale_id"))
@Getter
@Setter
public class StoreSaleAudit extends StoreAuditable {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "sale_id", nullable = false)
    private Long saleId;
    @Column(name = "bill_no", length = 30)
    private String billNo;
    /** CREATED, EDITED or DELETED. */
    @Column(nullable = false, length = 10)
    private String action;
    @Column(name = "total_before", precision = 12, scale = 2)
    private BigDecimal totalBefore;
    @Column(name = "total_after", precision = 12, scale = 2)
    private BigDecimal totalAfter;
    /** What changed, in words. */
    @Column(length = 2000)
    private String changes;
    @Lob
    @Column(columnDefinition = "LONGTEXT")
    private String snapshot;
}
