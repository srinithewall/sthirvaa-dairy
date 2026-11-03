package com.dairy.repo.ration;

import com.dairy.model.ration.RationItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RationItemRepository extends JpaRepository<RationItem, Long> {
    List<RationItem> findAllByOrderBySortOrderAscIdAsc();
    void deleteByGroupId(Long groupId);
}
