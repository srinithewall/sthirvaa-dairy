package com.dairy.repository;

import com.dairy.model.FeedMaster;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FeedMasterRepository extends JpaRepository<FeedMaster, Long> {
    @Query("SELECT DISTINCT f.category FROM FeedMaster f WHERE f.category IS NOT NULL ORDER BY f.category")
    List<String> findDistinctCategories();
    
    List<FeedMaster> findByCategory(String category);
}
