package com.dairy.service.bank;

import com.dairy.model.bank.BankStatementFile;
import com.dairy.repo.bank.BankStatementFileRepository;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.encryption.InvalidPasswordException;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Kotak's PDF statements, kept to be attached to the sales/purchase report.
 *
 * The PDF is not read for transactions - its text loses which column an amount was in, and Kotak
 * itself recommends the CSV for reconciliation. Only the period and account number are taken
 * from it, so it is filed against the right month.
 */
@Service
public class BankStatementService {

    /** "01 Oct 2026 - 31 Oct 2026", Kotak's statement heading. */
    private static final Pattern PERIOD = Pattern.compile(
        "(\\d{1,2} [A-Za-z]{3} \\d{4})\\s*[-–]\\s*(\\d{1,2} [A-Za-z]{3} \\d{4})");
    private static final Pattern ACCOUNT = Pattern.compile("Account No\\.?\\s*:?\\s*(\\d{6,})");
    private static final DateTimeFormatter DAY = new DateTimeFormatterBuilder()
        .parseCaseInsensitive().appendPattern("d MMM yyyy").toFormatter(Locale.ENGLISH);

    @Autowired
    private BankStatementFileRepository repository;

    /** What the first page says, read before anything is stored. */
    record Details(LocalDate from, LocalDate to, String accountLast4, int pages) {}

    @Transactional
    public BankStatementFile store(byte[] bytes, String fileName) {
        Details d = read(bytes);
        BankStatementFile file = repository.findFirstByPeriodFromAndPeriodTo(d.from(), d.to())
            .orElseGet(BankStatementFile::new);
        file.setPeriodFrom(d.from());
        file.setPeriodTo(d.to());
        file.setAccountLast4(d.accountLast4());
        file.setFileName(fileName);
        file.setPages(d.pages());
        file.setSizeBytes(bytes.length);
        file.setContent(bytes);
        file.setUploadedAt(LocalDateTime.now());
        file.setUploadedBy(currentUser());
        return repository.save(file);
    }

    static Details read(byte[] bytes) {
        try (PDDocument doc = Loader.loadPDF(bytes)) {
            PDFTextStripper stripper = new PDFTextStripper();
            stripper.setStartPage(1);
            stripper.setEndPage(1);
            return details(stripper.getText(doc), doc.getNumberOfPages());
        } catch (InvalidPasswordException ex) {
            throw new IllegalArgumentException("This PDF is password-protected. Download the statement from Kotak "
                + "net banking (it comes without a password) and import that");
        } catch (IOException ex) {
            throw new IllegalArgumentException("Could not read this PDF: " + ex.getMessage());
        }
    }

    static Details details(String firstPage, int pages) {
        Matcher period = PERIOD.matcher(firstPage);
        if (!period.find()) {
            throw new IllegalArgumentException("This PDF does not look like a Kotak statement: no period like "
                + "\"01 Oct 2026 - 31 Oct 2026\" on its first page");
        }
        LocalDate from = LocalDate.parse(period.group(1), DAY);
        LocalDate to = LocalDate.parse(period.group(2), DAY);
        Matcher account = ACCOUNT.matcher(firstPage);
        String last4 = account.find() ? account.group(1).substring(account.group(1).length() - 4) : null;
        return new Details(from, to, last4, pages);
    }

    /** Statements covering any day of from..to, without their content. */
    public List<Map<String, Object>> list(LocalDate from, LocalDate to) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (BankStatementFile f : repository.findByPeriodToGreaterThanEqualAndPeriodFromLessThanEqualOrderByPeriodFromAsc(from, to)) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", f.getId());
            m.put("periodFrom", f.getPeriodFrom());
            m.put("periodTo", f.getPeriodTo());
            m.put("accountLast4", f.getAccountLast4());
            m.put("fileName", f.getFileName());
            m.put("pages", f.getPages());
            m.put("uploadedAt", f.getUploadedAt());
            m.put("uploadedBy", f.getUploadedBy());
            out.add(m);
        }
        return out;
    }

    public BankStatementFile get(Long id) {
        return repository.findById(id).orElseThrow(() -> new NoSuchElementException("Statement " + id + " not found"));
    }

    public void delete(Long id) {
        repository.deleteById(id);
    }

    private static String currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth == null ? "system" : auth.getName();
    }
}
