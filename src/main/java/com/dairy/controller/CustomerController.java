package com.dairy.controller;

import com.dairy.model.Customer;
import com.dairy.model.CustomerPriceSlab;
import com.dairy.repo.CustomerRepository;
import com.dairy.service.CustomerPortalService;
import com.dairy.service.CustomerPricingService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/customers")
public class CustomerController {
    @Autowired
    private CustomerRepository customerRepository;

    @Autowired
    private CustomerPricingService pricingService;

    @Autowired
    private CustomerPortalService portalService;

    @GetMapping
    public List<Customer> getAllCustomers() {
        return customerRepository.findAll();
    }

    @PostMapping
    public Customer createCustomer(@RequestBody Customer customer) {
        return customerRepository.save(customer);
    }

    @PutMapping("/{id}")
    public Customer updateCustomer(@PathVariable Long id, @RequestBody Customer in) {
        Customer c = customerRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Customer not found: " + id));
        if (in.getName() != null && !in.getName().isBlank()) c.setName(in.getName().trim());
        if (in.getPhone() != null && !in.getPhone().isBlank()) c.setPhone(in.getPhone().trim());
        c.setAddress(in.getAddress());
        if (in.getDefaultRate() != null) c.setDefaultRate(in.getDefaultRate());
        String location = in.getDeliveryLocation() == null ? "" : in.getDeliveryLocation().trim();
        c.setDeliveryLocation(location.isEmpty() ? null : location);
        if (in.getDeliveryKm() != null && in.getDeliveryKm() < 0) throw new IllegalArgumentException("Distance can't be negative");
        c.setDeliveryKm(in.getDeliveryKm());
        return customerRepository.save(c);
    }

    /** Only a customer with no milk, sales or subscription on record. */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public Map<String, Object> deleteCustomer(@PathVariable Long id) {
        portalService.deleteCustomer(id);
        return Map.of("deleted", id);
    }

    // ── Milk price per customer ───────────────────────────────────────────────

    /** Every customer's price slabs, keyed by customer id. */
    @GetMapping("/price-slabs")
    public Map<Long, List<CustomerPriceSlab>> allPriceSlabs() {
        return pricingService.allSlabs();
    }

    @GetMapping("/{id}/price-slabs")
    public List<CustomerPriceSlab> priceSlabs(@PathVariable Long id) {
        return pricingService.slabs(id);
    }

    /** Replaces the customer's slabs: [{ fromLitres, milkRate, deliveryRate }]. */
    @PutMapping("/{id}/price-slabs")
    public List<CustomerPriceSlab> savePriceSlabs(@PathVariable Long id, @RequestBody List<CustomerPriceSlab> slabs) {
        return pricingService.saveSlabs(id, slabs);
    }

    /** GET /api/customers/{id}/quote?litres=12 → { milkRate, deliveryRate, rate } */
    @GetMapping("/{id}/quote")
    public CustomerPricingService.Quote quote(@PathVariable Long id, @RequestParam double litres) {
        return pricingService.quote(id, litres);
    }

    /** What the customer sees on their My Milk page, for the farm to preview. */
    @GetMapping("/{id}/milk-statement")
    public Map<String, Object> milkStatement(
            @PathVariable Long id,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate from,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate to) {
        Customer c = customerRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Customer not found: " + id));
        return portalService.statementFor(c, from, to);
    }

    // ── Customer login (admin only) ───────────────────────────────────────────

    @GetMapping("/{id}/login")
    @PreAuthorize("hasRole('ADMIN')")
    public Map<String, Object> login(@PathVariable Long id) {
        return portalService.loginInfo(id);
    }

    /** Body: { username, password } - password may be left out to keep the current one. */
    @PutMapping("/{id}/login")
    @PreAuthorize("hasRole('ADMIN')")
    public Map<String, Object> saveLogin(@PathVariable Long id, @RequestBody Map<String, String> body) {
        return portalService.saveLogin(id, body.get("username"), body.get("password"));
    }

    @DeleteMapping("/{id}/login")
    @PreAuthorize("hasRole('ADMIN')")
    public Map<String, Object> removeLogin(@PathVariable Long id) {
        portalService.removeLogin(id);
        return portalService.loginInfo(id);
    }
}
