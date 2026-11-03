package com.dairy.repo.bank;

import com.dairy.model.bank.SalaryAdvance;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SalaryAdvanceRepository extends JpaRepository<SalaryAdvance, Long> {
    List<SalaryAdvance> findByStaffIdOrderByDateAscIdAsc(Long staffId);

    boolean existsByStaffId(Long staffId);
}
