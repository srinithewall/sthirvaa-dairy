package com.dairy.repo;

import com.dairy.model.MilkRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

public interface MilkRecordRepository extends JpaRepository<MilkRecord, Long> {
    List<MilkRecord> findByDate(LocalDate date);
    List<MilkRecord> findByHerdId(Long herdId);

    @Query("SELECT SUM(m.quantity) FROM MilkRecord m")
    Double getTotalMilkProduction();

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.transaction.annotation.Transactional
    void deleteByHerdId(Long herdId);
    void deleteByDateAndShift(LocalDate date, String shift);
    List<MilkRecord> findByDateAndShift(LocalDate date, String shift);
    List<MilkRecord> findAllByOrderByDateDesc();
    List<MilkRecord> findByDateBetween(LocalDate startDate, LocalDate endDate);

    List<MilkRecord> findByHerdIdAndDateGreaterThanEqual(Long herdId, LocalDate startDate);

    /**
     * Daily totals per herd since a date, as [herdId, date, litres].
     * Lets the herd list build every animal's 30-day average from one query
     * instead of one query per animal.
     */
    @Query("SELECT m.herd.id, m.date, SUM(m.quantity) FROM MilkRecord m "
         + "WHERE m.herd.id IN :herdIds AND m.date >= :startDate "
         + "GROUP BY m.herd.id, m.date")
    List<Object[]> sumDailyByHerdIdsSince(@Param("herdIds") Collection<Long> herdIds,
                                          @Param("startDate") LocalDate startDate);

    /** Same as findByDate, but with the animal already joined - avoids a lazy load per record. */
    @Query("SELECT m FROM MilkRecord m LEFT JOIN FETCH m.herd WHERE m.date = :date")
    List<MilkRecord> findByDateWithHerd(@Param("date") LocalDate date);
}
