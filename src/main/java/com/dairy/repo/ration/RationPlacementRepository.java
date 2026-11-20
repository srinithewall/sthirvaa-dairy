package com.dairy.repo.ration;

import com.dairy.model.ration.RationPlacement;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.Optional;

public interface RationPlacementRepository extends JpaRepository<RationPlacement, Long> {
    Optional<RationPlacement> findByHerdId(Long herdId);
    void deleteByHerdIdIn(Collection<Long> herdIds);
    void deleteByGroupId(Long groupId);
}
