package com.dairy.repo.store;

import com.dairy.model.store.StoreItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface StoreItemRepository extends JpaRepository<StoreItem, Long> {
    List<StoreItem> findAllByOrderByNameAsc();
    List<StoreItem> findByActiveTrueOrderByNameAsc();
    boolean existsByNameIgnoreCase(String name);

    java.util.Optional<StoreItem> findFirstByNameIgnoreCase(String name);
    boolean existsByNameIgnoreCaseAndIdNot(String name, Long id);
}
