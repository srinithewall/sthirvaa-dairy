package com.dairy.service;

import com.dairy.model.Customer;
import com.dairy.model.Income;
import com.dairy.model.MilkDispatch;
import com.dairy.model.Sale;
import com.dairy.repo.CustomerRepository;
import com.dairy.repo.IncomeRepository;
import com.dairy.repo.MilkDispatchRepository;
import com.dairy.repo.SaleRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class MilkDispatchService {

    @Autowired private MilkDispatchRepository dispatchRepository;
    @Autowired private CustomerRepository customerRepository;
    @Autowired private IncomeRepository incomeRepository;
    @Autowired private SaleRepository saleRepository;
    @Autowired private CustomerPricingService pricingService;

    public List<MilkDispatch> getByDate(LocalDate date) {
        return dispatchRepository.findByDate(date);
    }

    /**
     * Save a full dispatch session for a date+shift.
     * Old records for that date+shift are wiped first (to allow correction).
     * Then income is recalculated.
     *
     * Each entry in the list:
     * { date, shift, dispatchType, customerId (optional), herdId (CALF only), quantity, ratePerLitre }
     */
    @Transactional
    public List<MilkDispatch> saveSession(List<Map<String, Object>> entries) {
        if (entries.isEmpty()) return List.of();

        LocalDate date = LocalDate.parse(entries.get(0).get("date").toString());
        String shift = entries.get(0).get("shift").toString();

        // Delete old records for this date+shift (enables correction from scratch)
        if ("COMBINED".equalsIgnoreCase(shift)) {
            dispatchRepository.deleteByDate(date);
        } else {
            dispatchRepository.deleteByDateAndShift(date, shift);
        }

        // The sales this session made last time it was saved, per customer, oldest first. Saving the
        // session again updates them row for row instead of adding a second set.
        String item = "Milk (" + shift + ")";
        Map<Long, java.util.Deque<Sale>> previousSales = new java.util.HashMap<>();
        for (Sale s : saleRepository.findByDateAndItemNameOrderByIdAsc(date, item)) {
            if (s.getCustomer() == null) continue;
            previousSales.computeIfAbsent(s.getCustomer().getId(), k -> new java.util.ArrayDeque<>()).add(s);
        }

        // Save new dispatches
        for (Map<String, Object> e : entries) {
            Double qty = Double.parseDouble(e.get("quantity").toString());
            if (qty <= 0) continue;

            MilkDispatch d = new MilkDispatch();
            d.setDate(LocalDate.parse(e.get("date").toString()));
            d.setShift(e.get("shift").toString());
            d.setQuantity(qty);

            String type = e.getOrDefault("dispatchType", "CUSTOMER").toString();
            d.setDispatchType(type);

            Double rate = 0.0;
            if ("CUSTOMER".equals(type)) {
                Object custIdObj = e.get("customerId");
                if (custIdObj == null) {
                    throw new RuntimeException("customerId is required for CUSTOMER dispatch type");
                }
                Long customerId = Long.parseLong(custIdObj.toString());
                Customer customer = customerRepository.findById(customerId)
                        .orElseThrow(() -> new RuntimeException("Customer not found: " + customerId));
                d.setCustomer(customer);
                // The customer's own price for this volume, unless the rate was set by hand.
                CustomerPricingService.Quote quote = pricingService.quote(customerId, qty);
                Object rateObj = e.get("ratePerLitre");
                rate = rateObj == null || rateObj.toString().isBlank()
                    ? quote.rate() : Double.parseDouble(rateObj.toString());
                Object deliveryObj = e.get("deliveryRate");
                double delivery = deliveryObj == null || deliveryObj.toString().isBlank()
                    ? quote.deliveryRate() : Double.parseDouble(deliveryObj.toString());
                d.setDeliveryRate(Math.max(0, Math.min(delivery, rate)));
                Object spot = e.get("deliveryLocation");
                if (spot != null && !spot.toString().isBlank()) d.setDeliveryLocation(spot.toString().trim());
            }
            if ("CALF".equals(type)) {
                Object herdIdObj = e.get("herdId");
                if (herdIdObj == null) {
                    throw new RuntimeException("Pick the calf for each calf feeding row");
                }
                d.setHerdId(Long.parseLong(herdIdObj.toString()));
            }
            d.setRatePerLitre(rate);
            d.setTotalAmount(qty * rate);
            dispatchRepository.save(d);

            // The Sales module's record of a customer dispatch: last save's sale for this customer
            // updated in place (its payment status kept), else a new pending one.
            if ("CUSTOMER".equals(type)) {
                java.util.Deque<Sale> mine = previousSales.get(d.getCustomer().getId());
                Sale sale = mine != null && !mine.isEmpty() ? mine.poll() : new Sale();
                sale.setDate(d.getDate());
                sale.setItemName(item);
                sale.setQuantity(d.getQuantity());
                sale.setPrice(d.getRatePerLitre());
                sale.setTotalAmount(d.getTotalAmount());
                sale.setCustomer(d.getCustomer());
                if (sale.getPaymentStatus() == null) sale.setPaymentStatus("PENDING"); // Default to pending for distribution
                saleRepository.save(sale);
            }
        }

        // Sales for deliveries no longer in the session go too - unless already paid.
        for (java.util.Deque<Sale> left : previousSales.values()) {
            for (Sale s : left) {
                if (!"PAID".equalsIgnoreCase(s.getPaymentStatus())) saleRepository.delete(s);
            }
        }

        // Recalculate daily income from all dispatches on this date
        Double totalRevenue = dispatchRepository.sumRevenueByDate(date);
        if (totalRevenue == null) totalRevenue = 0.0;

        // Upsert the income record for this date
        Optional<Income> existing = incomeRepository.findByCategoryAndDate("MILK_SALES", date);
        Income income = existing.orElse(new Income());
        income.setCategory("MILK_SALES");
        income.setDate(date);
        income.setAmount(totalRevenue);
        income.setDescription(String.format("Milk sales revenue for %s", date));
        incomeRepository.save(income);

        return dispatchRepository.findByDateAndShift(date, shift);
    }
}
