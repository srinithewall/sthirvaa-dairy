package com.dairy.repository;

import com.dairy.model.FeedNutrition;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface FeedNutritionRepository extends JpaRepository<FeedNutrition, Long> {
    Optional<FeedNutrition> findByFeedMasterId(Long feedMasterId);

    /**
     * Every nutrition row with its FeedMaster in a single round trip.
     *
     * FeedNutrition.feedMaster is @OneToOne, which defaults to EAGER, so fetching these
     * rows one id at a time cost two queries per feed. With ~110 seeded feeds against a
     * remote MySQL that dominated the default-plan response time. The explicit join fetch
     * keeps it to one query.
     *
     * Ordered by feed id to preserve the iteration order callers previously got from
     * FeedMasterRepository.findAll(), which the solver's tie-breaking depends on.
     */
    @Query("select n from FeedNutrition n join fetch n.feedMaster f order by f.id")
    List<FeedNutrition> findAllWithFeedMaster();

    /** Same single-round-trip join fetch, restricted to the given feeds. */
    @Query("select n from FeedNutrition n join fetch n.feedMaster f where f.id in :feedIds order by f.id")
    List<FeedNutrition> findByFeedMasterIdInWithFeedMaster(@Param("feedIds") Collection<Long> feedIds);
}
