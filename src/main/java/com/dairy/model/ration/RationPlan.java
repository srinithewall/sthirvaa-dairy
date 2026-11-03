package com.dairy.model.ration;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

/**
 * The plan period and purchase settings. Single row (id 1).
 * products holds per-product bag size, bag price, bags in stock and extra bags as JSON,
 * keyed "s:{storeItemId}" or "n:{lower-case name}" - edited on the purchase list.
 */
@Entity
@Table(name = "ration_plan")
@Getter
@Setter
public class RationPlan {
    @Id
    private Long id = 1L;

    @Column(name = "start_date")
    private LocalDate startDate;

    private Integer days = 45;

    @Column(name = "wastage_pct")
    private Double wastagePct = 5.0;

    @Lob
    @Column(columnDefinition = "TEXT")
    private String products;
}
