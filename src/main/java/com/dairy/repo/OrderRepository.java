package com.dairy.repo;

import com.dairy.model.Order;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface OrderRepository extends JpaRepository<Order, String> {
    List<Order> findByUserId(Long userId);
    List<Order> findByStatus(String status);

    /**
     * A user's orders with line items, their products and the buyer already joined.
     * Building the response DTO touches all three, and each is lazy - without this the
     * history page costs a query per order plus one per line item.
     */
    @Query("SELECT DISTINCT o FROM Order o "
         + "LEFT JOIN FETCH o.items item "
         + "LEFT JOIN FETCH item.product "
         + "LEFT JOIN FETCH o.user "
         + "WHERE o.user.id = :userId")
    List<Order> findByUserIdWithItems(@Param("userId") Long userId);

    /** Single order, joined the same way as findByUserIdWithItems. */
    @Query("SELECT o FROM Order o "
         + "LEFT JOIN FETCH o.items item "
         + "LEFT JOIN FETCH item.product "
         + "LEFT JOIN FETCH o.user "
         + "WHERE o.id = :id")
    Optional<Order> findByIdWithItems(@Param("id") String id);
}
