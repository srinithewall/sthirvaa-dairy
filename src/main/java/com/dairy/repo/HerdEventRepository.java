package com.dairy.repo;

import com.dairy.model.HerdEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Collection;
import java.util.List;

@Repository
public interface HerdEventRepository extends JpaRepository<HerdEvent, Long> {
    List<HerdEvent> findByHerdIdOrderByEventDateDesc(Long herdId);

    /** Event history for a set of animals in one query - used when enriching a herd list. */
    List<HerdEvent> findByHerdIdInOrderByEventDateDesc(Collection<Long> herdIds);
    List<HerdEvent> findByEventDate(java.time.LocalDate eventDate);
    List<HerdEvent> findAllByOrderByEventDateDesc();
    long countByHerdIdAndEventType(Long herdId, String eventType);

    @org.springframework.transaction.annotation.Transactional
    void deleteByHerdId(Long herdId);
}
