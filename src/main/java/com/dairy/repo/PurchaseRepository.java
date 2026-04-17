package com.dairy.repo;

import com.dairy.model.Purchase;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.List;

public interface PurchaseRepository extends JpaRepository<Purchase, Long> {
    List<Purchase> findByItemName(String itemName);
    List<Purchase> findByPurchaseDateBetween(LocalDate start, LocalDate end);
}
