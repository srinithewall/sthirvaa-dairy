package com.dairy.model.store;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "store_items")
@Getter
@Setter
public class StoreItem extends StoreAuditable {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String name;
    @Column(name = "kannada_name")
    private String kannadaName;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private StoreItemCategory category;
    /** Manufacturer, e.g. Cargill. Not the same as who we buy from (see supplierIds). */
    private String brand;
    /** Suppliers this item can be bought from; filled in by hand and learned from supplier bills. */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "store_item_suppliers", joinColumns = @JoinColumn(name = "item_id"))
    @Column(name = "supplier_id")
    private Set<Long> supplierIds = new HashSet<>();
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private StoreUnit unit;
    /** Size of one unit, e.g. 50 for a 50 kg bag. */
    @Column(name = "unit_size", precision = 10, scale = 3)
    private BigDecimal unitSize;
    @Column(name = "sale_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal salePrice;
    @Column(name = "min_sale_price", precision = 12, scale = 2)
    private BigDecimal minSalePrice;
    /** When set, minSalePrice (cost) is hidden from and not editable by STAFF. */
    @Column(name = "hide_price", nullable = false)
    private boolean hidePrice = false;
    @Column(name = "reorder_level", precision = 12, scale = 3)
    private BigDecimal reorderLevel = BigDecimal.ZERO;
    @Column(name = "shelf_life_days")
    private Integer shelfLifeDays;
    /** Optional link to the farm FeedMaster record, used for farm transfers. */
    @Column(name = "feed_master_id")
    private Long feedMasterId;
    @Column(name = "hsn_code", length = 20)
    private String hsnCode;
    @Column(name = "gst_rate", precision = 5, scale = 2)
    private BigDecimal gstRate;
    /** Diamonds a contact spends to take one unit free; null = not redeemable with diamonds. */
    @Column(name = "reward_coins")
    private Integer rewardCoins;
    @Column(nullable = false)
    private boolean active = true;
}
