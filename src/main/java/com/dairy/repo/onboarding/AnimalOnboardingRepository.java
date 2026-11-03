package com.dairy.repo.onboarding;

import com.dairy.model.onboarding.AnimalOnboarding;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface AnimalOnboardingRepository extends JpaRepository<AnimalOnboarding, Long> {
    List<AnimalOnboarding> findByStatusOrderByArrivalDateDesc(String status);

    List<AnimalOnboarding> findByHerdIdOrderByArrivalDateDesc(Long herdId);

    boolean existsByHerdIdAndStatus(Long herdId, String status);

    @Query("select o from AnimalOnboarding o join o.steps s where s.id = :stepId")
    Optional<AnimalOnboarding> findByStepId(@Param("stepId") Long stepId);

    /** herdId, arrivalDate, quarantineDays of the animals still settling in - for the herd list. */
    @Query("select o.herdId, o.arrivalDate, o.quarantineDays from AnimalOnboarding o "
            + "where o.status = 'ACTIVE' and o.herdId in :herdIds")
    List<Object[]> findActiveSummaryByHerdIdIn(@Param("herdIds") Collection<Long> herdIds);

    @Transactional
    void deleteByHerdId(Long herdId);
}
