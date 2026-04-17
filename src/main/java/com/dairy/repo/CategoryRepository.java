package com.dairy.repo;

import com.dairy.model.Category;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface CategoryRepository extends JpaRepository<Category, Long> {
    List<Category> findByType(Category.CategoryType type);
    boolean existsByNameAndType(String name, Category.CategoryType type);
}
