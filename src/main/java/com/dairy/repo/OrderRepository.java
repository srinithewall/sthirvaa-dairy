package com.dairy.repo;

import com.dairy.model.Order;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface OrderRepository extends JpaRepository<Order, String> {
    List<Order> findByUserId(Long userId);
    List<Order> findByStatus(String status);
}
