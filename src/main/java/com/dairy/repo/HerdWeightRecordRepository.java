package com.dairy.repo;

import com.dairy.model.HerdWeightRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface HerdWeightRecordRepository extends JpaRepository<HerdWeightRecord, Long> {
    List<HerdWeightRecord> findByHerdIdOrderByRecordDateDesc(Long herdId);
    List<HerdWeightRecord> findByHerdIdAndRecordDateBetweenOrderByRecordDateAsc(Long herdId, LocalDate start, LocalDate end);
    HerdWeightRecord findFirstByHerdIdOrderByRecordDateDesc(Long herdId);
}
