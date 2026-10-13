package com.dairy.model.store;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "store_suppliers")
@Getter
@Setter
public class StoreSupplier extends StoreAuditable {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false)
    private String name;
    private String phone;
    @Column(length = 20)
    private String gstin;
    private String address;
    @Column(nullable = false)
    private boolean active = true;
}
