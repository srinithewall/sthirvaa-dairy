package com.dairy.repo;

import com.dairy.model.ExpenseAttachment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

public interface ExpenseAttachmentRepository extends JpaRepository<ExpenseAttachment, Long> {

    /** What the list shows: everything but the file itself, so listing never loads the blobs. */
    interface Info {
        Long getId();
        Long getExpenseId();
        String getFileName();
        String getContentType();
        Integer getSizeBytes();
        LocalDateTime getUploadedAt();
        String getUploadedBy();
    }

    List<Info> findByExpenseIdOrderByIdAsc(Long expenseId);

    @Modifying
    @Transactional
    @Query("delete from ExpenseAttachment a where a.expenseId = :expenseId")
    void deleteByExpenseId(Long expenseId);
}
