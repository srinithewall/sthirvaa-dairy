package com.dairy.controller;

import com.dairy.model.User;
import com.dairy.model.Customer;
import com.dairy.repo.UserRepository;
import com.dairy.repo.CustomerRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
public class UserController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private CustomerRepository customerRepository;

    @GetMapping("/me/address")
    public ResponseEntity<?> getMyAddress() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User user = userRepository.findByEmail(email).orElseThrow(() -> new RuntimeException("User not found"));

        Map<String, Object> response = new HashMap<>();
        response.put("apartmentName", user.getApartmentName());
        response.put("towerNumber", user.getTowerNumber());
        response.put("doorNumber", user.getDoorNumber());
        response.put("deliveryAddress", user.getDeliveryAddress());
        return ResponseEntity.ok(response);
    }

    @PostMapping("/me/address")
    public ResponseEntity<?> updateMyAddress(@RequestBody Map<String, String> payload) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User user = userRepository.findByEmail(email).orElseThrow(() -> new RuntimeException("User not found"));

        String apartmentName = payload.get("apartmentName");
        String towerNumber = payload.get("towerNumber");
        String doorNumber = payload.get("doorNumber");

        String fullAddress = "Door " + doorNumber + ", Tower " + towerNumber + ", " + apartmentName + ", Bengaluru";

        user.setApartmentName(apartmentName);
        user.setTowerNumber(towerNumber);
        user.setDoorNumber(doorNumber);
        user.setDeliveryAddress(fullAddress);

        userRepository.save(user);

        // Also update customer address if user is linked to a customer
        if (user.getCustomerId() != null) {
            customerRepository.findById(user.getCustomerId()).ifPresent(customer -> {
                customer.setAddress(fullAddress);
                customerRepository.save(customer);
            });
        }

        Map<String, Object> response = new HashMap<>();
        response.put("apartmentName", apartmentName);
        response.put("towerNumber", towerNumber);
        response.put("doorNumber", doorNumber);
        response.put("deliveryAddress", fullAddress);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/me/fcm-token")
    public ResponseEntity<?> updateFcmToken(@RequestBody Map<String, String> payload) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User user = userRepository.findByEmail(email).orElseThrow(() -> new RuntimeException("User not found"));
        user.setFcmToken(payload.get("token"));
        userRepository.save(user);
        return ResponseEntity.ok().build();
    }
}
