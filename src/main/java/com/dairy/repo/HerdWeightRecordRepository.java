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
    
    @org.springframework.data.jpa.repository.Query("SELECT w FROM HerdWeightRecord w WHERE w.id IN (SELECT MAX(w2.id) FROM HerdWeightRecord w2 WHERE w2.herdId IN :herdIds GROUP BY w2.herdId)")
    List<HerdWeightRecord> findLatestByHerdIdIn(@org.springframework.data.repository.query.Param("herdIds") java.util.Collection<Long> herdIds);
}
