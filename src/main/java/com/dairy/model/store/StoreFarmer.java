package com.dairy.model.store;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Entity
@Table(name = "store_farmers")
@Getter
@Setter
public class StoreFarmer extends StoreAuditable {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false)
    private String name;
    @Column(nullable = false, unique = true, length = 15)
    private String phone;
    private String village;
    @Column(name = "cows_count")
    private Integer cowsCount;
    @Column(name = "credit_limit", precision = 12, scale = 2)
    private BigDecimal creditLimit = BigDecimal.ZERO;
    @Column(nullable = false)
    private boolean active = true;
}
