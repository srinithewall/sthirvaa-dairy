package com.dairy.repository;

import com.dairy.model.FeedPlanItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FeedPlanItemRepository extends JpaRepository<FeedPlanItem, Long> {
    List<FeedPlanItem> findByFeedPlanId(Long feedPlanId);
    void deleteByFeedPlanId(Long feedPlanId);
}
