package com.dairy.repository;

import com.dairy.model.FeedNutrition;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface FeedNutritionRepository extends JpaRepository<FeedNutrition, Long> {
    Optional<FeedNutrition> findByFeedMasterId(Long feedMasterId);
}
