package com.dairy.repo;

import com.dairy.model.MilkRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.List;

public interface MilkRecordRepository extends JpaRepository<MilkRecord, Long> {
    List<MilkRecord> findByDate(LocalDate date);
    List<MilkRecord> findByHerdId(Long herdId);
    List<MilkRecord> findAllByOrderByDateDesc();
}
