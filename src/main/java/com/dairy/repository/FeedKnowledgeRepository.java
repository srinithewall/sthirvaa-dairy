package com.dairy.repository;

import com.dairy.model.FeedKnowledge;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface FeedKnowledgeRepository extends JpaRepository<FeedKnowledge, Long> {
    Optional<FeedKnowledge> findByFeedMasterId(Long feedMasterId);
}
