package com.dairy.repo.bank;

import com.dairy.model.bank.BankStatementFile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface BankStatementFileRepository extends JpaRepository<BankStatementFile, Long> {
    /** Statements whose period overlaps from..to, oldest first. */
    List<BankStatementFile> findByPeriodToGreaterThanEqualAndPeriodFromLessThanEqualOrderByPeriodFromAsc(
        LocalDate from, LocalDate to);

    Optional<BankStatementFile> findFirstByPeriodFromAndPeriodTo(LocalDate from, LocalDate to);
}
