package com.dairy.service;

import com.dairy.model.Customer;
import com.dairy.model.CustomerPriceSlab;
import com.dairy.repo.CustomerPriceSlabRepository;
import com.dairy.repo.CustomerRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

/**
 * Each customer's own milk price: volume slabs of milk price + delivery charge per litre,
 * falling back to the customer's flat default rate when no slabs are set.
 */
@Service
public class CustomerPricingService {

    /** The price for one delivery: milkRate + deliveryRate = rate per litre. */
    public record Quote(double milkRate, double deliveryRate, double rate) {}

    @Autowired private CustomerPriceSlabRepository slabRepository;
    @Autowired private CustomerRepository customerRepository;

    public List<CustomerPriceSlab> slabs(Long customerId) {
        return slabRepository.findByCustomerIdOrderByFromLitresAsc(customerId);
    }

    /** Every customer's slabs, by customer id, for screens that price several customers at once. */
    public Map<Long, List<CustomerPriceSlab>> allSlabs() {
        Map<Long, List<CustomerPriceSlab>> out = new LinkedHashMap<>();
        for (CustomerPriceSlab s : slabRepository.findAllByOrderByCustomerIdAscFromLitresAsc()) {
            out.computeIfAbsent(s.getCustomerId(), k -> new ArrayList<>()).add(s);
        }
        return out;
    }

    /** Replaces a customer's slabs. Rows without a milk rate are dropped; one slab per starting volume. */
    @Transactional
    public List<CustomerPriceSlab> saveSlabs(Long customerId, List<CustomerPriceSlab> input) {
        customerRepository.findById(customerId)
            .orElseThrow(() -> new IllegalArgumentException("Customer not found: " + customerId));
        Map<Double, CustomerPriceSlab> byFrom = new TreeMap<>();
        for (CustomerPriceSlab in : input == null ? List.<CustomerPriceSlab>of() : input) {
            if (in.getMilkRate() == null || in.getMilkRate() <= 0) continue;
            double from = in.getFromLitres() == null ? 0 : in.getFromLitres();
            double delivery = in.getDeliveryRate() == null ? 0 : in.getDeliveryRate();
            if (from < 0 || delivery < 0) throw new IllegalArgumentException("Litres and rates can't be negative");
            CustomerPriceSlab slab = new CustomerPriceSlab(customerId, from, in.getMilkRate(), delivery);
            if (!in.getDeliveryAvailable()) {
                slab.setDeliveryAvailable(false);
                slab.setDeliveryRate(0.0);
            }
            byFrom.put(from, slab);
        }
        slabRepository.deleteByCustomerId(customerId);
        slabRepository.flush();
        return slabRepository.saveAll(byFrom.values());
    }

    public Quote quote(Long customerId, double litres) {
        Customer customer = customerRepository.findById(customerId)
            .orElseThrow(() -> new IllegalArgumentException("Customer not found: " + customerId));
        return quote(customer, slabs(customerId), litres);
    }

    /**
     * The slab with the highest starting volume at or below the litres delivered; below the
     * first slab, the first slab. No slabs: the customer's default rate, no delivery charge.
     */
    public static Quote quote(Customer customer, List<CustomerPriceSlab> slabs, double litres) {
        if (slabs == null || slabs.isEmpty()) {
            double rate = customer.getDefaultRate() == null ? 0 : customer.getDefaultRate();
            return new Quote(rate, 0, rate);
        }
        CustomerPriceSlab pick = slabs.stream()
            .sorted(Comparator.comparingDouble(CustomerPriceSlab::getFromLitres))
            .reduce(null, (best, s) -> best == null || s.getFromLitres() <= litres + 1e-9 ? s : best);
        double milk = pick.getMilkRate();
        double delivery = !pick.getDeliveryAvailable() || pick.getDeliveryRate() == null ? 0 : pick.getDeliveryRate();
        return new Quote(milk, delivery, milk + delivery);
    }
}
