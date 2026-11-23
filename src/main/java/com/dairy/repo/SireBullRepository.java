package com.dairy.repo;

import com.dairy.model.SireBull;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SireBullRepository extends JpaRepository<SireBull, Long> {
    Optional<SireBull> findByBullNo(String bullNo);
}
