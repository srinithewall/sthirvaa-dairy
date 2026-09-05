package com.dairy.service;

import com.dairy.dto.CheckoutRequestDTO;
import com.dairy.dto.OrderResponseDTO;
import com.dairy.model.*;
import com.dairy.repo.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class OrderService {

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ProductRepository productRepository;

    // Hardcoding a user ID for demo purposes if not using JWT parsing here
    private final Long DEMO_USER_ID = 1L;

    public OrderResponseDTO processCheckout(CheckoutRequestDTO request, String email) {
        User user = userRepository.findByEmail(email).orElseThrow(() -> new RuntimeException("User not found"));

        Order order = new Order();
        // Generate a random ID like INV-2026-000125
        order.setId("INV-" + LocalDateTime.now().getYear() + "-" + String.format("%06d", (int)(Math.random() * 1000000)));
        order.setUser(user);
        order.setDeliveryAddress(request.getDeliveryAddress());
        order.setPaymentMethod(request.getPaymentMethod());
        order.setPaymentStatus("PAID"); // Since it's a mock payment flow
        order.setStatus("PROCESSING");
        order.setSubtotal(request.getSubtotal());
        order.setDiscount(request.getDiscount());
        order.setGatewayFee(request.getGatewayFee());
        order.setTotal(request.getTotal());

        // Load every product in the cart in one query rather than one per line item.
        List<Long> productIds = new ArrayList<>();
        for (CheckoutRequestDTO.CheckoutItemDTO itemDto : request.getItems()) {
            productIds.add(itemDto.getProductId());
        }

        Map<Long, Product> productsById = new HashMap<>();
        for (Product product : productRepository.findAllById(productIds)) {
            productsById.put(product.getId(), product);
        }

        for (CheckoutRequestDTO.CheckoutItemDTO itemDto : request.getItems()) {
            Product product = productsById.get(itemDto.getProductId());
            // Still a hard failure, as before - an order must never quietly lose a line item.
            if (product == null) {
                throw new IllegalArgumentException("Unknown product in cart: " + itemDto.getProductId());
            }
            OrderItem item = new OrderItem(order, product, itemDto.getQuantity(), itemDto.getPrice());
            order.addItem(item);
        }

        order = orderRepository.save(order);
        return mapToResponseDTO(order);
    }

    public List<OrderResponseDTO> getMyOrders(String email) {
        User user = userRepository.findByEmail(email).orElseThrow(() -> new RuntimeException("User not found"));
        List<Order> orders = orderRepository.findByUserIdWithItems(user.getId());
        // Sort by created at desc
        orders.sort((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()));
        return orders.stream().map(this::mapToResponseDTO).collect(Collectors.toList());
    }

    public OrderResponseDTO getOrderById(String id) {
        Order order = orderRepository.findByIdWithItems(id)
                .orElseThrow(() -> new RuntimeException("Order not found"));
        return mapToResponseDTO(order);
    }

    private OrderResponseDTO mapToResponseDTO(Order order) {
        OrderResponseDTO dto = new OrderResponseDTO();
        dto.setId(order.getId());
        
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("dd MMM yyyy");
        dto.setInvoiceDate(order.getCreatedAt().format(formatter));
        dto.setDueDate(order.getCreatedAt().plusDays(15).format(formatter)); // Mock due date

        dto.setTotal(order.getTotal());
        dto.setStatus(order.getStatus());
        dto.setPaymentStatus(order.getPaymentStatus());
        dto.setSubtotal(order.getSubtotal());
        dto.setDiscount(order.getDiscount());
        dto.setGatewayFee(order.getGatewayFee());

        OrderResponseDTO.CustomerDTO customerDTO = new OrderResponseDTO.CustomerDTO();
        customerDTO.setName(order.getUser().getUsername());
        customerDTO.setEmail(order.getUser().getEmail());
        customerDTO.setPhone("+91 98765 43210"); // Mock phone
        customerDTO.setAddress(order.getDeliveryAddress());
        dto.setCustomer(customerDTO);

        List<OrderResponseDTO.OrderItemDTO> itemDTOs = new ArrayList<>();
        for (OrderItem item : order.getItems()) {
            OrderResponseDTO.OrderItemDTO itemDTO = new OrderResponseDTO.OrderItemDTO();
            itemDTO.setName(item.getProduct().getName());
            itemDTO.setDescription(item.getProduct().getCategory());
            itemDTO.setQty(item.getQuantity());
            itemDTO.setPrice(item.getPrice());
            itemDTO.setAmount(item.getPrice() * item.getQuantity());
            itemDTOs.add(itemDTO);
        }
        dto.setItems(itemDTOs);

        return dto;
    }
}
