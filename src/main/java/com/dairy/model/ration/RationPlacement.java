package com.dairy.model.ration;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

/**
 * The batch the rules last put an animal in, and from when. Lets the ration plan keep a cow in
 * her batch for a few days before the rules move her again, so a milk figure wobbling around a
 * batch's limit doesn't switch her feed back and forth. Animals pinned by hand have no row here.
 */
@Entity
@Table(name = "ration_placements",
       uniqueConstraints = @UniqueConstraint(name = "uk_ration_placement_herd", columnNames = "herd_id"))
@Getter
@Setter
public class RationPlacement {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "herd_id", nullable = false)
    private Long herdId;

    @Column(name = "group_id", nullable = false)
    private Long groupId;

    /** First day she was fed in this batch. */
    @Column(nullable = false)
    private LocalDate since;
}
