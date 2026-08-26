package com.dairy.repository;

import com.dairy.model.AnimalRequirement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface AnimalRequirementRepository extends JpaRepository<AnimalRequirement, Long> {
    Optional<AnimalRequirement> findByAnimalStage(String animalStage);
}
