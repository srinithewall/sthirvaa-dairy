package com.dairy.repo;

import com.dairy.config.CacheConfig;
import com.dairy.model.Breed;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface BreedRepository extends JpaRepository<Breed, Long> {

    @Cacheable(CacheConfig.BREEDS)
    Optional<Breed> findByName(String name);

    /**
     * Cached: the herd list reads the whole breed table on every request to resolve
     * weight formulas, and these rows effectively never change.
     */
    @Override
    @Cacheable(value = CacheConfig.BREEDS, key = "'all'")
    List<Breed> findAll();

    @Override
    @CacheEvict(value = CacheConfig.BREEDS, allEntries = true)
    <S extends Breed> S save(S breed);

    @Override
    @CacheEvict(value = CacheConfig.BREEDS, allEntries = true)
    void deleteById(Long id);
}
