package com.dairy.controller;

import com.dairy.model.Order;
import com.dairy.model.OrderItem;
import com.dairy.model.Product;
import com.dairy.model.User;
import com.dairy.repo.OrderRepository;
import com.dairy.repo.ProductRepository;
import com.dairy.repo.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/orders")
public class OrderController {

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private UserRepository userRepository;

    @GetMapping
    public List<Order> getMyOrders() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .map(user -> orderRepository.findByUserId(user.getId()))
                .orElse(java.util.Collections.emptyList());
    }

    @GetMapping("/all")
    @PreAuthorize("@ss.can('ORDERS')")
    public List<Order> getAllOrders(@RequestParam(required = false) String status) {
        if (status != null && !status.isEmpty() && !"all".equalsIgnoreCase(status)) {
            return orderRepository.findByStatus(status);
        }
        return orderRepository.findAll();
    }

    @PostMapping
    public ResponseEntity<Order> createOrder(@RequestBody Map<String, Object> payload) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User user = userRepository.findByEmail(email).orElseThrow();

        Order order = new Order();
        order.setId("ST-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        order.setUser(user);
        order.setDeliveryAddress(payload.get("deliveryAddress").toString());
        if (payload.containsKey("paymentMethod")) {
            order.setPaymentMethod(payload.get("paymentMethod").toString());
        }
        order.setStatus("PENDING");
        order.setCreatedAt(LocalDateTime.now());

        List<Map<String, Object>> itemsList = (List<Map<String, Object>>) payload.get("items");
        List<OrderItem> orderItems = itemsList.stream().map(itemMap -> {
            Long productId = Long.parseLong(itemMap.get("id").toString());
            Integer qty = Integer.parseInt(itemMap.get("quantity").toString());
            Product product = productRepository.findById(productId).orElseThrow();
            
            OrderItem item = new OrderItem();
            item.setOrder(order);
            item.setProduct(product);
            item.setQuantity(qty);
            item.setPrice(product.getPrice()); // Freeze the price at checkout
            return item;
        }).collect(Collectors.toList());

        order.setItems(orderItems);
        order.setTotal(orderItems.stream().mapToDouble(i -> i.getPrice() * i.getQuantity()).sum());

        return ResponseEntity.ok(orderRepository.save(order));
    }

    @PutMapping("/{id}/status")
    @PreAuthorize("@ss.can('ORDERS')")
    public ResponseEntity<Order> updateStatus(@PathVariable String id, @RequestBody Map<String, String> payload) {
        return orderRepository.findById(id).map(order -> {
            order.setStatus(payload.get("status"));
            return ResponseEntity.ok(orderRepository.save(order));
        }).orElse(ResponseEntity.notFound().build());
    }
}
