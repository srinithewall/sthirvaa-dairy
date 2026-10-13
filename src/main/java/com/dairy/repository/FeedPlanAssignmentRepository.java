package com.dairy.repository;

import com.dairy.model.FeedPlanAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface FeedPlanAssignmentRepository extends JpaRepository<FeedPlanAssignment, Long> {

    List<FeedPlanAssignment> findByFeedPlanId(Long feedPlanId);

    /** Assignment rows for several plans at once, so a plan list needs one query, not one per plan. */
    List<FeedPlanAssignment> findByFeedPlanIdIn(Collection<Long> feedPlanIds);

    List<FeedPlanAssignment> findByHerdId(Long herdId);

    void deleteByFeedPlanId(Long feedPlanId);
}
