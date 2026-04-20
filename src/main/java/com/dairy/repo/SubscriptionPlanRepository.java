package com.dairy.repo;

import com.dairy.model.SubscriptionPlan;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface SubscriptionPlanRepository extends JpaRepository<SubscriptionPlan, Long> {
    List<SubscriptionPlan> findAllByOrderByDisplayOrderAsc();
    List<SubscriptionPlan> findByIsActiveTrueOrderByDisplayOrderAsc();
    Optional<SubscriptionPlan> findBySlug(String slug);
}
