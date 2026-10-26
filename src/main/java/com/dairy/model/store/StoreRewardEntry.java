package com.dairy.model.store;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

/**
 * Sthirvaa Diamonds account of a contact. coins > 0 earned (on money paid), coins < 0 spent on
 * redeemed items. Balance = sum of coins.
 */
@Entity
@Table(name = "store_rewards", indexes = @Index(name = "idx_store_rewards_farmer", columnList = "farmer_id, entry_date"))
@Getter
@Setter
public class StoreRewardEntry extends StoreAuditable {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "farmer_id")
    private StoreFarmer farmer;
    @Column(name = "entry_date", nullable = false)
    private LocalDate entryDate;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private StoreRewardType type;
    @Column(nullable = false)
    private int coins;
    @Column(name = "sale_id")
    private Long saleId;
    private String notes;
}
