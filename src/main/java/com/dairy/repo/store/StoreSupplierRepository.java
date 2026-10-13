package com.dairy.repo.store;

import com.dairy.model.store.StoreSupplier;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface StoreSupplierRepository extends JpaRepository<StoreSupplier, Long> {
    List<StoreSupplier> findAllByOrderByNameAsc();
}
