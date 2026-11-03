package com.dairy.repo.bank;

import com.dairy.model.bank.SalaryRule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SalaryRuleRepository extends JpaRepository<SalaryRule, Long> {
    Optional<SalaryRule> findByStaffId(Long staffId);
}
