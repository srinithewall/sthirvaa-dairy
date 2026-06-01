package com.dairy.repo;

import com.dairy.model.HerdEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface HerdEventRepository extends JpaRepository<HerdEvent, Long> {
    List<HerdEvent> findByHerdIdOrderByEventDateDesc(Long herdId);
}
