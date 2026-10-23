package com.dairy.repo;

import com.dairy.model.AmcsCollection;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface AmcsCollectionRepository extends JpaRepository<AmcsCollection, Long> {
    Optional<AmcsCollection> findByMemberCodeAndDateAndShiftAndSampleNo(
        String memberCode, LocalDate date, String shift, Integer sampleNo);

    List<AmcsCollection> findByDateAndShift(LocalDate date, String shift);

    List<AmcsCollection> findByDateBetweenOrderByDateDescShiftAsc(LocalDate from, LocalDate to);
}
