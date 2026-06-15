package com.dairy.repository;

import com.dairy.model.SemenCatalog;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface SemenCatalogRepository extends JpaRepository<SemenCatalog, Long> {
    List<SemenCatalog> findByStatusAndAnimalTypeIn(String status, List<String> types);
    List<SemenCatalog> findByStatus(String status);
}
