package com.dairy.repo.ration;

import com.dairy.model.ration.RationGroup;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RationGroupRepository extends JpaRepository<RationGroup, Long> {
    List<RationGroup> findAllByOrderBySortOrderAscIdAsc();
}
