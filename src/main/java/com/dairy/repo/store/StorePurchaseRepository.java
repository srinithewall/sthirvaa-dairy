package com.dairy.repo.store;

import com.dairy.model.store.StorePurchase;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface StorePurchaseRepository extends JpaRepository<StorePurchase, Long> {
    List<StorePurchase> findByPurchaseDateBetweenOrderByPurchaseDateDescIdDesc(LocalDate from, LocalDate to);
}
