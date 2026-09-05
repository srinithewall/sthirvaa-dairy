package com.dairy.repository;

import com.dairy.model.FeedPlan;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FeedPlanRepository extends JpaRepository<FeedPlan, Long> {
    List<FeedPlan> findByHerdIdOrderByUpdatedAtDesc(Long herdId);
    Optional<FeedPlan> findByIdAndHerdId(Long id, Long herdId);
}
