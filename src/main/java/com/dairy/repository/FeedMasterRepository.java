package com.dairy.repository;

import com.dairy.config.CacheConfig;
import com.dairy.model.FeedMaster;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FeedMasterRepository extends JpaRepository<FeedMaster, Long> {

    @Cacheable(value = CacheConfig.FEED_MASTER, key = "'categories'")
    @Query("SELECT DISTINCT f.category FROM FeedMaster f WHERE f.category IS NOT NULL ORDER BY f.category")
    List<String> findDistinctCategories();

    @Cacheable(value = CacheConfig.FEED_MASTER, key = "'byCategory:' + #category")
    List<FeedMaster> findByCategory(String category);

    /** Cached: the feed catalogue is read throughout the optimizer and changes rarely. */
    @Override
    @Cacheable(value = CacheConfig.FEED_MASTER, key = "'all'")
    List<FeedMaster> findAll();

    @Override
    @CacheEvict(value = CacheConfig.FEED_MASTER, allEntries = true)
    <S extends FeedMaster> S save(S feed);

    @Override
    @CacheEvict(value = CacheConfig.FEED_MASTER, allEntries = true)
    <S extends FeedMaster> List<S> saveAll(Iterable<S> feeds);

    @Override
    @CacheEvict(value = CacheConfig.FEED_MASTER, allEntries = true)
    void deleteById(Long id);
}
