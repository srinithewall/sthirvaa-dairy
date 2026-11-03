package com.dairy.repo;

import com.dairy.model.EmergencyContact;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface EmergencyContactRepository extends JpaRepository<EmergencyContact, Long> {
    List<EmergencyContact> findAllByOrderBySortOrderAscIdAsc();
}
