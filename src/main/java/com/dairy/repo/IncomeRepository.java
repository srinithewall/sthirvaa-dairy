package com.dairy.repo;

import com.dairy.model.Income;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface IncomeRepository extends JpaRepository<Income, Long> {
    List<Income> findByCategory(String category);
    Optional<Income> findByCategoryAndDate(String category, LocalDate date);
    List<Income> findByDateBetween(LocalDate startDate, LocalDate endDate);
}
