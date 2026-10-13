package com.dairy.model.store;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "store_sales", indexes = @Index(name = "idx_store_sale_date", columnList = "sale_date"))
@Getter
@Setter
public class StoreSale extends StoreAuditable {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "bill_no", unique = true, length = 30)
    private String billNo;
    @Column(name = "sale_date", nullable = false)
    private LocalDate saleDate;
    /** Null for walk-in customers. */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "farmer_id")
    private StoreFarmer farmer;
    @Column(name = "customer_name")
    private String customerName;
    @Column(name = "customer_phone", length = 15)
    private String customerPhone;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private StoreSaleType type = StoreSaleType.CUSTOMER;
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal subtotal = BigDecimal.ZERO;
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal discount = BigDecimal.ZERO;
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal total = BigDecimal.ZERO;
    @Column(name = "cost_total", nullable = false, precision = 12, scale = 2)
    private BigDecimal costTotal = BigDecimal.ZERO;
    @Enumerated(EnumType.STRING)
    @Column(name = "payment_mode", nullable = false, length = 10)
    private StorePaymentMode paymentMode = StorePaymentMode.CASH;
    @Column(name = "paid_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal paidAmount = BigDecimal.ZERO;
    private String notes;
    @OneToMany(mappedBy = "sale", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    private List<StoreSaleLine> lines = new ArrayList<>();
}
