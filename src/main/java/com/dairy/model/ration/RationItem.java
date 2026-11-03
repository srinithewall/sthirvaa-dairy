package com.dairy.model.ration;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

/**
 * One line of a batch's ration: what to give each animal in the morning and evening feed.
 * fromDate/toDate let a line apply only part of the plan, e.g. Milkgen 5000+ for the first
 * 15 days and Milkgen 8000 after; either end left empty means open.
 */
@Entity
@Table(name = "ration_items")
@Getter
@Setter
public class RationItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @Column(name = "group_id", nullable = false)
    private Long groupId;

    /** Shop item this feed is bought as; null for farm-grown or unlisted feeds. */
    @Column(name = "store_item_id")
    private Long storeItemId;

    @Column(nullable = false)
    private String name;

    /** CONCENTRATE, FODDER, MINERAL, MILK or OTHER. Concentrate and mineral go on the purchase list. */
    @Column(nullable = false, length = 20)
    private String kind = "CONCENTRATE";

    /** KG, G or L - per animal, per feed. */
    @Column(nullable = false, length = 5)
    private String unit = "KG";

    @Column(name = "morning_qty")
    private Double morningQty = 0.0;

    @Column(name = "evening_qty")
    private Double eveningQty = 0.0;

    @Column(name = "from_date")
    private LocalDate fromDate;

    @Column(name = "to_date")
    private LocalDate toDate;

    @Column(name = "sort_order")
    private Integer sortOrder = 0;
}
