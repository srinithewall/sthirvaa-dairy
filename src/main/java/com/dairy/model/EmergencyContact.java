package com.dairy.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

/** A number to call when an animal has a problem - the vet, an AI technician, the dairy society... */
@Entity
@Table(name = "emergency_contacts")
@Getter
@Setter
public class EmergencyContact {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    /** Vet, AI technician, Medical shop... shown under the name. */
    @Column(length = 60)
    private String role;

    @Column(nullable = false, length = 20)
    private String phone;

    @Column(name = "sort_order")
    private Integer sortOrder = 0;
}
