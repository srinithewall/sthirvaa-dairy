package com.dairy.service;

import com.dairy.model.*;
import com.dairy.repo.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@Slf4j
public class SubscriptionService {

    @Autowired
    private SubscriptionPlanRepository planRepository;

    @Autowired
    private CustomerSubscriptionRepository customerSubRepository;

    @Autowired
    private ProductRepository productRepository;

    public List<SubscriptionPlan> getAllActivePlans() {
        return planRepository.findByIsActiveTrueOrderByDisplayOrderAsc();
    }

    public Optional<SubscriptionPlan> getPlanBySlug(String slug) {
        return planRepository.findBySlug(slug);
    }

    /**
     * Calculates the savings text for a plan (Dynamic replacement of the old included_savings field)
     */
    public String calculateSavingsText(SubscriptionPlan plan) {
        double totalMrp = 0;
        double totalSelling = 0;
        
        for (SubscriptionPlanItem item : plan.getItems()) {
            // Assume 30 days calculation for monthly context
            int multiplier = 30;
            if (item.getFrequency() == SubscriptionPlanItem.DeliveryFrequency.DAILY) {
                multiplier = 30;
            } else if (item.getFrequency() == SubscriptionPlanItem.DeliveryFrequency.WEEKLY) {
                multiplier = 4;
            }
            
            totalMrp += (item.getMrp() * item.getQty() * multiplier);
            totalSelling += (item.getSellingPrice() * item.getQty() * multiplier);
        }
        
        double savings = totalMrp - plan.getMonthlyPrice();
        if (savings > 0) {
            return String.format("Includes Savings ₹%.0f/month", savings);
        }
        return "Best Value Bundle";
    }

    @Transactional
    public CustomerSubscription enrollCustomer(Long customerId, Long planId, CustomerSubscription.BillingCycle cycle) {
        SubscriptionPlan plan = planRepository.findById(planId)
                .orElseThrow(() -> new RuntimeException("Plan not found"));

        double price = switch (cycle) {
            case MONTHLY -> plan.getMonthlyPrice();
            case QUARTERLY -> plan.getQuarterlyPrice() != null ? plan.getQuarterlyPrice() : plan.getMonthlyPrice() * 3;
            case YEARLY -> plan.getYearlyPrice() != null ? plan.getYearlyPrice() : plan.getMonthlyPrice() * 12;
            default -> plan.getMonthlyPrice();
        };

        CustomerSubscription sub = new CustomerSubscription();
        sub.setCustomerId(customerId);
        sub.setPlan(plan);
        sub.setBillingCycle(cycle);
        sub.setAmount(price);
        sub.setStartDate(LocalDate.now());
        sub.setStatus(CustomerSubscription.Status.ACTIVE);
        
        // Calculate next renewal
        int months = switch (cycle) {
            case QUARTERLY -> 3;
            case YEARLY -> 12;
            case HALF_YEARLY -> 6;
            default -> 1;
        };
        sub.setNextRenewal(LocalDate.now().plusMonths(months));

        return customerSubRepository.save(sub);
    }
}
