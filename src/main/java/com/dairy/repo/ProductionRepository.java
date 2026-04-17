package com.dairy.repo;

import com.dairy.model.Production;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.List;

public interface ProductionRepository extends JpaRepository<Production, Long> {
    List<Production> findByItemName(String itemName);
    List<Production> findByProductionDateBetween(LocalDate start, LocalDate end);
}
