package com.dairy.repo;

import com.dairy.model.FarmActivityLog;
import com.dairy.model.ActivityStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface FarmActivityLogRepository extends JpaRepository<FarmActivityLog, Long> {
    List<FarmActivityLog> findByDueDate(LocalDate dueDate);
    List<FarmActivityLog> findByDueDateBetween(LocalDate startDate, LocalDate endDate);
    List<FarmActivityLog> findByActivityIdAndDueDate(Long activityId, LocalDate dueDate);
    List<FarmActivityLog> findByDueDateAndStatusIn(LocalDate dueDate, List<ActivityStatus> statuses);
    List<FarmActivityLog> findByDueDateLessThanAndStatusIn(LocalDate dueDate, List<ActivityStatus> statuses);
    List<FarmActivityLog> findByActivityIdOrderByDueDateDesc(Long activityId);
    List<FarmActivityLog> findByDueDateLessThanEqualAndStatusIn(LocalDate dueDate, List<ActivityStatus> statuses);
    List<FarmActivityLog> findByActivityIdAndDueDateGreaterThanEqualAndStatusIn(
            Long activityId, LocalDate dueDate, List<ActivityStatus> statuses);
}
