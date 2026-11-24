package com.dairy.service;

import com.dairy.model.Customer;
import com.dairy.model.MilkDispatch;
import com.dairy.model.Role;
import com.dairy.model.User;
import com.dairy.repo.CustomerRepository;
import com.dairy.repo.MilkDispatchRepository;
import com.dairy.repo.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;

/**
 * Customer logins: the farm creates one per customer, and the customer signs in to see the milk
 * delivered to them each day and what it costs - their own records only.
 */
@Service
public class CustomerPortalService {

    @Autowired private UserRepository userRepository;
    @Autowired private CustomerRepository customerRepository;
    @Autowired private MilkDispatchRepository dispatchRepository;
    @Autowired private CustomerPricingService pricingService;
    @Autowired private com.dairy.repo.SaleRepository saleRepository;
    @Autowired private com.dairy.repo.CustomerSubscriptionRepository subscriptionRepository;
    @Autowired private com.dairy.repo.CustomerPriceSlabRepository slabRepository;

    // ── Login management (farm side) ──────────────────────────────────────────

    /** { hasLogin, username } for the customer's login, if any. */
    public Map<String, Object> loginInfo(Long customerId) {
        Optional<User> u = userRepository.findFirstByCustomerIdAndRole(customerId, Role.CUSTOMER);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("hasLogin", u.isPresent());
        out.put("username", u.map(User::getUsername).orElse(null));
        return out;
    }

    /** Creates the customer's login, or changes its username and password. */
    @Transactional
    public Map<String, Object> saveLogin(Long customerId, String username, String password) {
        customerRepository.findById(customerId)
            .orElseThrow(() -> new IllegalArgumentException("Customer not found: " + customerId));
        String name = username == null ? "" : username.trim();
        if (name.isEmpty()) throw new IllegalArgumentException("Enter a username for the customer");
        if (name.contains(" ")) throw new IllegalArgumentException("The username can't have spaces");

        User user = userRepository.findFirstByCustomerIdAndRole(customerId, Role.CUSTOMER).orElse(null);
        boolean isNew = user == null;
        if (isNew && (password == null || password.length() < 4)) {
            throw new IllegalArgumentException("Set a password of at least 4 characters");
        }
        // Sign-in matches either the username or the email, so neither may belong to anyone else.
        String email = name.contains("@") ? name : name + "@customer.sthirvaa";
        Long selfId = isNew ? null : user.getId();
        if (takenByOther(userRepository.findByUsername(name), selfId)
            || takenByOther(userRepository.findByEmail(name), selfId)
            || takenByOther(userRepository.findByEmail(email), selfId)) {
            throw new IllegalArgumentException("That username is already in use - pick another");
        }
        if (isNew) {
            user = new User();
            user.setRole(Role.CUSTOMER);
            user.setCustomerId(customerId);
        }
        user.setUsername(name);
        user.setEmail(email);
        if (password != null && !password.isEmpty()) {
            if (password.length() < 4) throw new IllegalArgumentException("Set a password of at least 4 characters");
            user.setPassword(password);
        }
        userRepository.save(user);
        return loginInfo(customerId);
    }

    @Transactional
    public void removeLogin(Long customerId) {
        userRepository.findFirstByCustomerIdAndRole(customerId, Role.CUSTOMER).ifPresent(userRepository::delete);
    }

    /**
     * Deletes a customer with its prices and login - only one that never got milk, a sale or a
     * subscription, so no bill or ledger entry loses its customer.
     */
    @Transactional
    public void deleteCustomer(Long customerId) {
        Customer c = customerRepository.findById(customerId)
            .orElseThrow(() -> new IllegalArgumentException("Customer not found: " + customerId));
        if (dispatchRepository.existsByCustomer_Id(customerId) || saleRepository.existsByCustomer_Id(customerId)
            || !subscriptionRepository.findByCustomerId(customerId).isEmpty()) {
            throw new IllegalArgumentException(c.getName() + " has milk, sales or a subscription on record, so it can't be deleted");
        }
        removeLogin(customerId);
        slabRepository.deleteByCustomerId(customerId);
        customerRepository.delete(c);
    }

    private static boolean takenByOther(Optional<User> found, Long selfId) {
        return found.isPresent() && !found.get().getId().equals(selfId);
    }

    // ── The customer's own view ───────────────────────────────────────────────

    /** The signed-in customer, from the login email (the security principal). */
    public Customer currentCustomer(String principal) {
        User user = userRepository.findByEmail(principal)
            .or(() -> userRepository.findByUsername(principal))
            .orElseThrow(() -> new IllegalStateException("Not signed in"));
        if (user.getCustomerId() == null) {
            throw new IllegalStateException("This login isn't linked to a milk customer yet - ask the farm");
        }
        return customerRepository.findById(user.getCustomerId())
            .orElseThrow(() -> new IllegalStateException("Customer not found"));
    }

    /** The statement for from..to, defaulting to this month so far; at most a year at a time. */
    public Map<String, Object> statementFor(Customer customer, LocalDate from, LocalDate to) {
        LocalDate end = to == null ? LocalDate.now() : to;
        LocalDate start = from == null ? end.withDayOfMonth(1) : from;
        if (start.isAfter(end)) throw new IllegalArgumentException("'from' is after 'to'");
        if (start.plusDays(366).isBefore(end)) throw new IllegalArgumentException("Pick at most a year at a time");
        return statement(customer, start, end);
    }

    /**
     * Milk delivered to the customer from..to: one row per day (morning, evening, total litres,
     * amount; whole-day deliveries count only in the total), the deliveries behind them, totals, and their current price slabs.
     */
    public Map<String, Object> statement(Customer customer, LocalDate from, LocalDate to) {
        List<MilkDispatch> rows = dispatchRepository
            .findByCustomer_IdAndDispatchTypeAndDateBetweenOrderByDateAscShiftDesc(customer.getId(), "CUSTOMER", from, to);

        Map<LocalDate, Map<String, Object>> days = new TreeMap<>(Comparator.reverseOrder());
        double totalLitres = 0, totalAmount = 0, totalDelivery = 0;
        for (MilkDispatch d : rows) {
            double qty = d.getQuantity() == null ? 0 : d.getQuantity();
            double amount = d.getTotalAmount() == null ? 0 : d.getTotalAmount();
            double delivery = (d.getDeliveryRate() == null ? 0 : d.getDeliveryRate()) * qty;
            totalLitres += qty;
            totalAmount += amount;
            totalDelivery += delivery;

            Map<String, Object> day = days.computeIfAbsent(d.getDate(), k -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("date", k.toString());
                m.put("morning", 0.0);
                m.put("evening", 0.0);
                m.put("litres", 0.0);
                m.put("amount", 0.0);
                m.put("deliveries", new ArrayList<Map<String, Object>>());
                return m;
            });
            String shift = d.getShift() == null ? "" : d.getShift().toUpperCase();
            // A COMBINED (whole-day) delivery isn't split into morning and evening; it only adds to the total.
            if (shift.equals("EVENING")) day.put("evening", (double) day.get("evening") + qty);
            else if (shift.equals("MORNING")) day.put("morning", (double) day.get("morning") + qty);
            day.put("litres", (double) day.get("litres") + qty);
            day.put("amount", (double) day.get("amount") + amount);

            Map<String, Object> del = new LinkedHashMap<>();
            del.put("shift", d.getShift());
            del.put("litres", qty);
            del.put("rate", d.getRatePerLitre());
            del.put("deliveryRate", d.getDeliveryRate() == null ? 0 : d.getDeliveryRate());
            del.put("location", d.getDeliveryLocation());
            del.put("amount", amount);
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> list = (List<Map<String, Object>>) day.get("deliveries");
            list.add(del);
        }

        Map<String, Object> cust = new LinkedHashMap<>();
        cust.put("id", customer.getId());
        cust.put("name", customer.getName());
        cust.put("phone", customer.getPhone());
        cust.put("address", customer.getAddress());

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("customer", cust);
        out.put("from", from.toString());
        out.put("to", to.toString());
        out.put("days", new ArrayList<>(days.values()));
        out.put("totalLitres", totalLitres);
        out.put("totalAmount", totalAmount);
        out.put("totalDelivery", totalDelivery);
        out.put("deliveryDays", days.size());
        out.put("slabs", pricingService.slabs(customer.getId()));
        out.put("defaultRate", customer.getDefaultRate());
        return out;
    }
}
