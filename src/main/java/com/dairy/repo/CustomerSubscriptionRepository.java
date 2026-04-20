package com.dairy.repo;

import com.dairy.model.CustomerSubscription;
import com.dairy.model.CustomerSubscription.Status;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface CustomerSubscriptionRepository extends JpaRepository<CustomerSubscription, Long> {
    List<CustomerSubscription> findByStatus(Status status);
    List<CustomerSubscription> findByCustomerId(Long customerId);
    Optional<CustomerSubscription> findByCustomerIdAndStatus(Long customerId, Status status);
    List<CustomerSubscription> findByPlanId(Long planId);
    List<CustomerSubscription> findByNextRenewalBeforeAndStatus(LocalDate date, Status status);
}
