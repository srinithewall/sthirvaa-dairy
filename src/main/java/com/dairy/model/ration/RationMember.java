package com.dairy.model.ration;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

/**
 * Puts one animal in one feeding batch by hand. This overrides the batch rules: an animal with
 * a row here stays in that batch whatever its herd data says. Without a row the rules decide.
 */
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
