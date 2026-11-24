package com.dairy.service;

import com.dairy.model.Expense;
import com.dairy.model.ExpenseAttachment;
import com.dairy.repo.ExpenseAttachmentRepository;
import com.dairy.repo.ExpenseRepository;
import java.util.Locale;
import java.util.NoSuchElementException;
import java.util.Set;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.List;
import java.util.Optional;

@Service
public class ExpenseService {

    @Autowired
    private ExpenseRepository expenseRepository;

    @Autowired
    private ExpenseAttachmentRepository attachmentRepository;

    public List<Expense> getAllExpenses() {
        return expenseRepository.findAll();
    }

    public Optional<Expense> getExpenseById(Long id) {
        return expenseRepository.findById(id);
    }

    public Expense saveExpense(Expense expense) {
        return expenseRepository.save(expense);
    }

    public void deleteExpense(Long id) {
        attachmentRepository.deleteByExpenseId(id);
        expenseRepository.deleteById(id);
    }

    private static final Set<String> ATTACHMENT_TYPES =
            Set.of("application/pdf", "image/jpeg", "image/png", "image/webp");

    public List<ExpenseAttachmentRepository.Info> getAttachments(Long expenseId) {
        return attachmentRepository.findByExpenseIdOrderByIdAsc(expenseId);
    }

    public List<ExpenseAttachmentRepository.Info> addAttachment(Long expenseId, byte[] bytes, String fileName, String contentType) {
        if (!expenseRepository.existsById(expenseId)) {
            throw new NoSuchElementException("Expense " + expenseId + " not found");
        }
        String type = contentType == null ? "" : contentType.toLowerCase(Locale.ROOT);
        if (type.equals("image/jpg")) type = "image/jpeg";
        if (!ATTACHMENT_TYPES.contains(type)) {
            throw new IllegalArgumentException("Attachments must be PDF, JPG, PNG or WEBP");
        }
        if (bytes.length == 0) {
            throw new IllegalArgumentException("The file is empty");
        }
        String name = fileName == null || fileName.isBlank() ? "attachment" : fileName;
        ExpenseAttachment a = new ExpenseAttachment();
        a.setExpenseId(expenseId);
        a.setFileName(name.length() > 200 ? name.substring(name.length() - 200) : name);
        a.setContentType(type);
        a.setSizeBytes(bytes.length);
        a.setContent(bytes);
        a.setUploadedAt(LocalDateTime.now());
        a.setUploadedBy(currentUser());
        attachmentRepository.save(a);
        return getAttachments(expenseId);
    }

    public ExpenseAttachment getAttachment(Long expenseId, Long attachmentId) {
        return attachmentRepository.findById(attachmentId)
                .filter(a -> a.getExpenseId().equals(expenseId))
                .orElseThrow(() -> new NoSuchElementException("Attachment " + attachmentId + " not found"));
    }

    public List<ExpenseAttachmentRepository.Info> deleteAttachment(Long expenseId, Long attachmentId) {
        attachmentRepository.delete(getAttachment(expenseId, attachmentId));
        return getAttachments(expenseId);
    }

    private static String currentUser() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null ? auth.getName() : null;
    }

    public List<Expense> getExpensesByCategory(String category) {
        return expenseRepository.findByCategory(category);
    }

    public List<Expense> getExpensesByDateRange(LocalDate start, LocalDate end) {
        return expenseRepository.findByDateBetween(start, end);
    }

    public Double getTotalExpenseByDateRange(LocalDate start, LocalDate end) {
        return expenseRepository.findByDateBetween(start, end)
                .stream()
                .filter(e -> !e.isUnaccounted())
                .mapToDouble(Expense::getAmount)
                .sum();
    }

    /**
     * Marks all unsettled expenses paid by the given staff member as settled.
     * If month is null/"ALL", settles across all time; otherwise restricts to that month (yyyy-MM).
     */
    public List<Expense> settleExpensesForStaff(String paidBy, String month) {
        List<Expense> unsettled;
        if (month == null || month.isBlank() || "ALL".equalsIgnoreCase(month)) {
            unsettled = expenseRepository.findByPaidByAndSettledFalse(paidBy);
        } else {
            YearMonth ym = YearMonth.parse(month);
            unsettled = expenseRepository.findByPaidByAndSettledFalseAndDateBetween(
                    paidBy, ym.atDay(1), ym.atEndOfMonth());
        }

        String settledBy = SecurityContextHolder.getContext().getAuthentication() != null
                ? SecurityContextHolder.getContext().getAuthentication().getName()
                : null;
        LocalDateTime now = LocalDateTime.now();

        for (Expense e : unsettled) {
            e.setSettled(true);
            e.setSettledAt(now);
            e.setSettledBy(settledBy);
        }
        return expenseRepository.saveAll(unsettled);
    }
}
