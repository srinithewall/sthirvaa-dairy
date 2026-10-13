package com.dairy.model.store;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Farmer credit (udhaar) account. amount > 0 adds to what the farmer owes (unpaid part of a bill),
 * amount < 0 reduces it (payment received). Balance = sum of amounts.
 */
@Entity
@Table(name = "store_ledger", indexes = @Index(name = "idx_store_ledger_farmer", columnList = "farmer_id, entry_date"))
@Getter
@Setter
public class StoreLedgerEntry extends StoreAuditable {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "farmer_id")
    private StoreFarmer farmer;
    @Column(name = "entry_date", nullable = false)
    private LocalDate entryDate;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private StoreLedgerType type;
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;
    @Column(name = "sale_id")
    private Long saleId;
    @Enumerated(EnumType.STRING)
    @Column(name = "payment_mode", length = 10)
    private StorePaymentMode paymentMode;
    private String notes;
}
