package com.dairy.repo;

import com.dairy.config.CacheConfig;
import com.dairy.model.Category;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CategoryRepository extends JpaRepository<Category, Long> {

    @Cacheable(CacheConfig.CATEGORIES)
    List<Category> findByType(Category.CategoryType type);

    boolean existsByNameAndType(String name, Category.CategoryType type);

    @Override
    @Cacheable(value = CacheConfig.CATEGORIES, key = "'all'")
    List<Category> findAll();

    @Override
    @CacheEvict(value = CacheConfig.CATEGORIES, allEntries = true)
    <S extends Category> S save(S category);

    @Override
    @CacheEvict(value = CacheConfig.CATEGORIES, allEntries = true)
    <S extends Category> List<S> saveAll(Iterable<S> categories);

    @Override
    @CacheEvict(value = CacheConfig.CATEGORIES, allEntries = true)
    void deleteById(Long id);
}
