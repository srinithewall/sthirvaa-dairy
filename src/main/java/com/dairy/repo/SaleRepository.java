package com.dairy.repo;

import com.dairy.model.Sale;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.List;

public interface SaleRepository extends JpaRepository<Sale, Long> {
    List<Sale> findByCustomerId(Long customerId);
    boolean existsByCustomer_Id(Long customerId);
    List<Sale> findByPaymentStatus(String paymentStatus);
    List<Sale> findByDateBetween(LocalDate startDate, LocalDate endDate);
    /** The sales one milk session created ("Milk (MORNING)" etc. on a date), oldest first. */
    List<Sale> findByDateAndItemNameOrderByIdAsc(LocalDate date, String itemName);
}
