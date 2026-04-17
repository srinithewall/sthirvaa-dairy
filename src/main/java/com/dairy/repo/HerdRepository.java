package com.dairy.repo;

import com.dairy.model.Herd;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface HerdRepository extends JpaRepository<Herd, Long> {
    Optional<Herd> findByTagNumber(String tagNumber);
    List<Herd> findByAnimalType(String animalType);
    List<Herd> findByStatus(String status);
}
