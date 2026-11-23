package com.dairy.repo;

import com.dairy.model.Herd;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface HerdRepository extends JpaRepository<Herd, Long> {
    Optional<Herd> findByTagNumber(String tagNumber);
    List<Herd> findByAnimalType(String animalType);
    List<Herd> findByStatus(String status);

    /** Sets (or with nulls clears) a cow's base minimum weight; touches nothing else on her record. */
    @Modifying
    @Transactional
    @Query("update Herd h set h.baseMinWeightKg = :kg, h.baseMinWeightDate = :on, h.baseMinWeightManual = :manual where h.id = :id")
    int setBaseMinWeight(@Param("id") Long id, @Param("kg") Double kg, @Param("on") LocalDate on, @Param("manual") Boolean manual);

    /** The app's one-time suggestion: written only while she has no base minimum yet. */
    @Modifying
    @Transactional
    @Query("update Herd h set h.baseMinWeightKg = :kg, h.baseMinWeightDate = :on, h.baseMinWeightManual = false where h.id = :id and h.baseMinWeightKg is null")
    int suggestBaseMinWeight(@Param("id") Long id, @Param("kg") Double kg, @Param("on") LocalDate on);
}
