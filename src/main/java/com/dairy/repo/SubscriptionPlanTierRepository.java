package com.dairy.repo;

import com.dairy.model.SubscriptionPlanTier;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface SubscriptionPlanTierRepository extends JpaRepository<SubscriptionPlanTier, Long> {
    List<SubscriptionPlanTier> findByPlanIdOrderByDurationMonthsAsc(Long planId);
    void deleteByPlanId(Long planId);
}
