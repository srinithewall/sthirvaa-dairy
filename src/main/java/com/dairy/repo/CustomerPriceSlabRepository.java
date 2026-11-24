package com.dairy.repo;

import com.dairy.model.CustomerPriceSlab;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CustomerPriceSlabRepository extends JpaRepository<CustomerPriceSlab, Long> {
    List<CustomerPriceSlab> findByCustomerIdOrderByFromLitresAsc(Long customerId);
    List<CustomerPriceSlab> findAllByOrderByCustomerIdAscFromLitresAsc();
    void deleteByCustomerId(Long customerId);
}
