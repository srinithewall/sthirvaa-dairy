package com.dairy.repo;

import com.dairy.model.FarmActivity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FarmActivityRepository extends JpaRepository<FarmActivity, Long> {
    List<FarmActivity> findByIsActiveTrue();
    Optional<FarmActivity> findBySystemKey(String systemKey);
}
