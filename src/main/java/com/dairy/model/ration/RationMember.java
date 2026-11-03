package com.dairy.model.ration;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

/** Puts one animal in one feeding batch. An animal is in at most one batch. */
@Entity
@Table(name = "ration_members",
       uniqueConstraints = @UniqueConstraint(name = "uk_ration_member_herd", columnNames = "herd_id"))
@Getter
@Setter
public class RationMember {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "herd_id", nullable = false)
    private Long herdId;

    @Column(name = "group_id", nullable = false)
    private Long groupId;
}
