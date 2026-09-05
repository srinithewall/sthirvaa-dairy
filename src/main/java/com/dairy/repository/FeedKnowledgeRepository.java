package com.dairy.repository;

import com.dairy.model.FeedKnowledge;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FeedKnowledgeRepository extends JpaRepository<FeedKnowledge, Long> {
    Optional<FeedKnowledge> findByFeedMasterId(Long feedMasterId);

    /**
     * Every knowledge row with its FeedMaster in a single round trip.
     *
     * FeedKnowledge.feedMaster is @OneToOne and so loads eagerly: a plain findAll() issues
     * one extra SELECT per row, which on ~110 feeds dominated GET /api/feeds.
     */
    @Query("select k from FeedKnowledge k join fetch k.feedMaster")
    List<FeedKnowledge> findAllWithFeedMaster();
}
