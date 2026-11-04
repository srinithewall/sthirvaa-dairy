package com.dairy.repo.bank;

import com.dairy.model.bank.BankMonthNote;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface BankMonthNoteRepository extends JpaRepository<BankMonthNote, Long> {
    Optional<BankMonthNote> findByMonth(String month);
}
