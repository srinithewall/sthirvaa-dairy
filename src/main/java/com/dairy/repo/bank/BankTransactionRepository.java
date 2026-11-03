package com.dairy.repo.bank;

import com.dairy.model.bank.BankTransaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Set;

public interface BankTransactionRepository extends JpaRepository<BankTransaction, Long> {
    List<BankTransaction> findByTxnDateBetweenOrderByTxnDateDescIdDesc(LocalDate from, LocalDate to);

    List<BankTransaction> findByStatusIn(Collection<String> statuses);

    @Query("SELECT t.dedupeKey FROM BankTransaction t WHERE t.dedupeKey IN :keys")
    Set<String> findExistingKeys(Collection<String> keys);

    /** Ledger entries already paired with a bank line, so one entry is never matched twice. */
    @Query("SELECT t.ledgerId FROM BankTransaction t WHERE t.kind = :kind AND t.ledgerId IS NOT NULL")
    Set<Long> findLedgerIdsByKind(String kind);

    @Query("SELECT MAX(t.txnDate) FROM BankTransaction t")
    LocalDate findLatestTxnDate();

    @Query("SELECT MAX(t.fetchedAt) FROM BankTransaction t")
    LocalDateTime findLastFetchedAt();

    long countByStatus(String status);

    /** Money in booked (or suggested) as a settlement of a category, e.g. the society's milk payments. */
    @Query("SELECT t FROM BankTransaction t WHERE t.direction = 'CREDIT' AND t.kind = 'SETTLEMENT'"
        + " AND t.category = :category AND t.status IN :statuses")
    List<BankTransaction> findSettlementCredits(String category, Collection<String> statuses);
}
