package com.dairy.repo.store;

import com.dairy.model.store.StoreFarmer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface StoreFarmerRepository extends JpaRepository<StoreFarmer, Long> {
    Optional<StoreFarmer> findByPhone(String phone);
    boolean existsByPhoneAndIdNot(String phone, Long id);
    List<StoreFarmer> findAllByOrderByNameAsc();

    @Query("SELECT f FROM StoreFarmer f WHERE LOWER(f.name) LIKE LOWER(CONCAT('%', :q, '%')) "
            + "OR f.phone LIKE CONCAT('%', :q, '%') ORDER BY f.name")
    List<StoreFarmer> search(@Param("q") String q);
}
