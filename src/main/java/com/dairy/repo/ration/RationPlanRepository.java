package com.dairy.repo.ration;

import com.dairy.model.ration.RationPlan;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RationPlanRepository extends JpaRepository<RationPlan, Long> {
}
