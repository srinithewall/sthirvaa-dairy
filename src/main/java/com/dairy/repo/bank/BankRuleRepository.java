package com.dairy.repo.bank;

import com.dairy.model.bank.BankRule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface BankRuleRepository extends JpaRepository<BankRule, Long> {
    List<BankRule> findAllByOrderByPatternAsc();

    Optional<BankRule> findFirstByPatternAndDirection(String pattern, String direction);
}
