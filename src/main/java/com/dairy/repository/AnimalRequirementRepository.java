package com.dairy.repository;

import com.dairy.config.CacheConfig;
import com.dairy.model.AnimalRequirement;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AnimalRequirementRepository extends JpaRepository<AnimalRequirement, Long> {

    @Cacheable(CacheConfig.ANIMAL_REQUIREMENTS)
    Optional<AnimalRequirement> findByAnimalStage(String animalStage);

    /** Cached: seeded at startup and read-only thereafter. */
    @Override
    @Cacheable(value = CacheConfig.ANIMAL_REQUIREMENTS, key = "'all'")
    List<AnimalRequirement> findAll();

    @Override
    @CacheEvict(value = CacheConfig.ANIMAL_REQUIREMENTS, allEntries = true)
    <S extends AnimalRequirement> S save(S requirement);

    @Override
    @CacheEvict(value = CacheConfig.ANIMAL_REQUIREMENTS, allEntries = true)
    <S extends AnimalRequirement> List<S> saveAll(Iterable<S> requirements);

    @Override
    @CacheEvict(value = CacheConfig.ANIMAL_REQUIREMENTS, allEntries = true)
    void deleteAll();

    /**
     * Matches on animalStage plus any of breed/bodyWeight/milkYield that the row
     * actually constrains (columns are nullable and, as of this writing, unpopulated
     * for every seeded row - so this degrades to a stage-only match until real
     * breed/weight/yield data is entered). Used by AnimalRequirementResolutionService
     * to pick the most specific matching row when several qualify.
     *
     * NOTE: AnimalRequirement.animalStage currently has a single-column UNIQUE
     * constraint, so at most one row can ever exist per stage today - this query
     * can only return >1 row once that constraint is relaxed to a composite
     * (stage + breed) key, a data-modeling decision left for whoever validates
     * the actual breed-specific requirement values.
     */
    @Query("SELECT r FROM AnimalRequirement r WHERE r.animalStage = :stage "
            + "AND (r.breed IS NULL OR LOWER(r.breed) = LOWER(:breed)) "
            + "AND (r.bodyWeightMin IS NULL OR :bodyWeight IS NULL OR :bodyWeight >= r.bodyWeightMin) "
            + "AND (r.bodyWeightMax IS NULL OR :bodyWeight IS NULL OR :bodyWeight <= r.bodyWeightMax) "
            + "AND (r.milkYieldMin IS NULL OR :milkYield IS NULL OR :milkYield >= r.milkYieldMin) "
            + "AND (r.milkYieldMax IS NULL OR :milkYield IS NULL OR :milkYield <= r.milkYieldMax)")
    List<AnimalRequirement> findMatching(@Param("stage") String stage,
                                          @Param("breed") String breed,
                                          @Param("bodyWeight") Double bodyWeight,
                                          @Param("milkYield") Double milkYield);
}
