package com.dairy.controller;

import com.dairy.model.SubscriptionPlan;
import com.dairy.model.SubscriptionPlanItem;
import com.dairy.repo.SubscriptionPlanRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/subscription-plans")
public class SubscriptionPlanController {

    @Autowired
    private SubscriptionPlanRepository subscriptionPlanRepository;

    @GetMapping
    public List<SubscriptionPlan> getAllPlans() {
        return subscriptionPlanRepository.findAllByOrderBySortOrderAsc();
    }

    @PostMapping
    @PreAuthorize("hasAuthority('ADMIN') or @ss.can('SHOP')")
    public SubscriptionPlan createPlan(@RequestBody SubscriptionPlan plan) {
        if (plan.getItems() != null) {
            plan.getItems().forEach(item -> item.setPlan(plan));
        }
        return subscriptionPlanRepository.save(plan);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('ADMIN') or @ss.can('SHOP')")
    public ResponseEntity<SubscriptionPlan> updatePlan(@PathVariable Long id, @RequestBody SubscriptionPlan planUpdates) {
        return subscriptionPlanRepository.findById(id).map(existing -> {
            existing.setName(planUpdates.getName());
            existing.setTagline(planUpdates.getTagline());
            existing.setPricePerMonth(planUpdates.getPricePerMonth());
            existing.setOriginalPrice(planUpdates.getOriginalPrice());
            existing.setMilkLiters(planUpdates.getMilkLiters());
            existing.setMilkFrequency(planUpdates.getMilkFrequency());
            existing.setBadgeText(planUpdates.getBadgeText());
            existing.setIncludedSavings(planUpdates.getIncludedSavings());
            existing.setImageUrl(planUpdates.getImageUrl());
            existing.setSortOrder(planUpdates.getSortOrder());

            // Clear and replace items to ensure orphan removal triggers
            existing.getItems().clear();
            if (planUpdates.getItems() != null) {
                for (SubscriptionPlanItem item : planUpdates.getItems()) {
                    item.setPlan(existing);
                    existing.getItems().add(item);
                }
            }

            return ResponseEntity.ok(subscriptionPlanRepository.save(existing));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('ADMIN') or @ss.can('SHOP')")
    public ResponseEntity<Void> deletePlan(@PathVariable Long id) {
        if (subscriptionPlanRepository.existsById(id)) {
            subscriptionPlanRepository.deleteById(id);
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }
}
