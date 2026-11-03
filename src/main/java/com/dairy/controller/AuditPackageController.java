package com.dairy.controller;

import com.dairy.model.audit.AuditPackage;
import com.dairy.model.audit.AuditPackageAttachment;
import com.dairy.model.bank.BankStatementFile;
import com.dairy.service.audit.AuditPackageService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.YearMonth;
import java.util.List;
import java.util.Map;

/**
 * Monthly auditor packages. Who may read or change them is the FINANCE row of role_permissions,
 * applied to /api/audit-packages by ModulePermissionInterceptor. The check below also keeps
 * customers out, whom the interceptor does not look at.
 */
@RestController
@PreAuthorize("@ss.can('FINANCE', 'VIEW')")
@RequestMapping("/api/audit-packages")
public class AuditPackageController {

    @Autowired
    private AuditPackageService service;

    @GetMapping
    public List<Map<String, Object>> list() {
        return service.list();
    }

    /** Opens the month's package (month = YYYY-MM), creating it with the month's cash expenses. */
    @PostMapping
    public Map<String, Object> open(@RequestParam String month) {
        return service.open(YearMonth.parse(month));
    }

    @GetMapping("/{id}")
    public Map<String, Object> view(@PathVariable Long id) {
        return service.view(id);
    }

    /** Body: includeGst, gstNote, notes. */
    @PutMapping("/{id}")
    public Map<String, Object> update(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        return service.update(id, body);
    }

    @PostMapping("/{id}/refresh")
    public Map<String, Object> refresh(@PathVariable Long id) {
        return service.refresh(id);
    }

    @PostMapping("/{id}/expenses")
    public Map<String, Object> addExpense(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        return service.addExpense(id, body);
    }

    /** Body: any of excluded, reviewed, date, category, description, amount, paidBy. */
    @PatchMapping("/{id}/expenses/{lineId}")
    public Map<String, Object> updateExpense(@PathVariable Long id, @PathVariable Long lineId,
                                             @RequestBody Map<String, Object> body) {
        return service.updateExpense(id, lineId, body);
    }

    @PostMapping(value = "/{id}/attachments", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, Object> addAttachment(@PathVariable Long id, @RequestParam("file") MultipartFile file) throws IOException {
        return service.addAttachment(id, file.getBytes(), file.getOriginalFilename(), file.getContentType());
    }

    @PatchMapping("/{id}/attachments/{attachmentId}")
    public Map<String, Object> setAttachmentIncluded(@PathVariable Long id, @PathVariable Long attachmentId,
                                                     @RequestBody Map<String, Object> body) {
        return service.setAttachmentIncluded(id, attachmentId, Boolean.TRUE.equals(body.get("included")));
    }

    @DeleteMapping("/{id}/attachments/{attachmentId}")
    public Map<String, Object> deleteAttachment(@PathVariable Long id, @PathVariable Long attachmentId) {
        return service.deleteAttachment(id, attachmentId);
    }

    @GetMapping("/{id}/attachments/{attachmentId}/file")
    public ResponseEntity<byte[]> attachmentFile(@PathVariable Long id, @PathVariable Long attachmentId) {
        AuditPackageAttachment a = service.attachment(id, attachmentId);
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(a.getContentType())).body(a.getContent());
    }

    @GetMapping("/{id}/statements/{statementId}/file")
    public ResponseEntity<byte[]> statementFile(@PathVariable Long id, @PathVariable Long statementId) {
        BankStatementFile s = service.statement(id, statementId);
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_PDF).body(s.getContent());
    }

    /** The merged PDF as downloaded, kept as the package's document. */
    @PostMapping(value = "/{id}/document", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, Object> saveDocument(@PathVariable Long id, @RequestParam("file") MultipartFile file) throws IOException {
        return service.saveDocument(id, file.getBytes());
    }

    @GetMapping("/{id}/document")
    public ResponseEntity<byte[]> document(@PathVariable Long id) {
        AuditPackage p = service.get(id);
        if (p.getDocument() == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok()
            .contentType(MediaType.APPLICATION_PDF)
            .header("Content-Disposition", "attachment; filename=\"auditor-package-" + p.getPeriodFrom().toString().substring(0, 7) + ".pdf\"")
            .body(p.getDocument());
    }
}
