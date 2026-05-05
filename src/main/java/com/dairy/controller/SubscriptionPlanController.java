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

    @Autowired
    private com.dairy.service.SubscriptionService subscriptionService;

    @GetMapping
    public List<SubscriptionPlan> getAllPlans() {
        return subscriptionPlanRepository.findByIsActiveTrueOrderByDisplayOrderAsc();
    }

    @GetMapping("/{slug}")
    public ResponseEntity<SubscriptionPlan> getBySlug(@PathVariable String slug) {
        return subscriptionPlanRepository.findBySlug(slug)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    @PreAuthorize("@ss.can('SHOP', 'CREATE')")
    public SubscriptionPlan createPlan(@RequestBody SubscriptionPlan plan) {
        if (plan.getItems() != null) {
            plan.getItems().forEach(item -> item.setPlan(plan));
        }
        if (plan.getTiers() != null) {
            plan.getTiers().forEach(tier -> tier.setPlan(plan));
        }
        return subscriptionPlanRepository.save(plan);
    }

    @PutMapping("/{id}")
    @PreAuthorize("@ss.can('SHOP', 'EDIT')")
    public ResponseEntity<SubscriptionPlan> updatePlan(@PathVariable Long id, @RequestBody SubscriptionPlan planUpdates) {
        return subscriptionPlanRepository.findById(id).map(existing -> {
            existing.setName(planUpdates.getName());
            existing.setTagline(planUpdates.getTagline());
            existing.setMonthlyPrice(planUpdates.getMonthlyPrice());
            existing.setTotalMrp(planUpdates.getTotalMrp());
            existing.setBadgeText(planUpdates.getBadgeText());
            existing.setImageUrl(planUpdates.getImageUrl());
            existing.setDisplayOrder(planUpdates.getDisplayOrder());
            existing.setIsActive(planUpdates.getIsActive());
            existing.setSavings(planUpdates.getSavings());
            existing.setTotalValue(planUpdates.getTotalValue());
            existing.setIncludesPoojaPack(planUpdates.getIncludesPoojaPack());

            // Clear and replace items
            existing.getItems().clear();
            if (planUpdates.getItems() != null) {
                for (SubscriptionPlanItem item : planUpdates.getItems()) {
                    item.setPlan(existing);
                    existing.getItems().add(item);
                }
            }

            // Clear and replace tiers
            existing.getTiers().clear();
            if (planUpdates.getTiers() != null) {
                for (com.dairy.model.SubscriptionPlanTier tier : planUpdates.getTiers()) {
                    tier.setPlan(existing);
                    existing.getTiers().add(tier);
                }
            }

            return ResponseEntity.ok(subscriptionPlanRepository.save(existing));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("@ss.can('SHOP', 'DELETE')")
    public ResponseEntity<Void> deletePlan(@PathVariable Long id) {
        if (subscriptionPlanRepository.existsById(id)) {
            subscriptionPlanRepository.deleteById(id);
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }
}
