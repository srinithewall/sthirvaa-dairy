package com.dairy.service;

import com.dairy.model.Customer;
import com.dairy.model.Income;
import com.dairy.model.MilkDispatch;
import com.dairy.repo.CustomerRepository;
import com.dairy.repo.IncomeRepository;
import com.dairy.repo.MilkDispatchRepository;
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

    public List<MilkDispatch> getByDate(LocalDate date) {
        return dispatchRepository.findByDate(date);
    }

    /**
     * Save a full dispatch session for a date+shift.
     * Old records for that date+shift are wiped first (to allow correction).
     * Then income is recalculated.
     *
     * Each entry in the list:
     * { date, shift, dispatchType, customerId (optional), quantity, ratePerLitre }
     */
    @Transactional
    public List<MilkDispatch> saveSession(List<Map<String, Object>> entries) {
        if (entries.isEmpty()) return List.of();

        LocalDate date = LocalDate.parse(entries.get(0).get("date").toString());
        String shift = entries.get(0).get("shift").toString();

        // Delete old records for this date+shift (enables correction from scratch)
        dispatchRepository.deleteByDateAndShift(date, shift);

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
                Long customerId = Long.parseLong(e.get("customerId").toString());
                Customer customer = customerRepository.findById(customerId)
                        .orElseThrow(() -> new RuntimeException("Customer not found: " + customerId));
                d.setCustomer(customer);
                rate = Double.parseDouble(e.get("ratePerLitre").toString());
            }
            d.setRatePerLitre(rate);
            d.setTotalAmount(qty * rate);
            dispatchRepository.save(d);
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
