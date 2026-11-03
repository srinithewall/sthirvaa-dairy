package com.dairy.controller;

import com.dairy.model.EmergencyContact;
import com.dairy.repo.EmergencyContactRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Numbers to call when an animal falls sick; anyone can read them, herd managers keep them. */
@RestController
@RequestMapping("/api/emergency-contacts")
public class EmergencyContactController {

    @Autowired
    private EmergencyContactRepository repository;

    @GetMapping
    public List<EmergencyContact> list() {
        return repository.findAllByOrderBySortOrderAscIdAsc();
    }

    @PostMapping
    @PreAuthorize("@ss.can('HERDS')")
    public EmergencyContact create(@RequestBody EmergencyContact body) {
        body.setId(null);
        return repository.save(clean(body));
    }

    @PutMapping("/{id}")
    @PreAuthorize("@ss.can('HERDS')")
    public ResponseEntity<EmergencyContact> update(@PathVariable Long id, @RequestBody EmergencyContact body) {
        return repository.findById(id).map(c -> {
            c.setName(body.getName());
            c.setRole(body.getRole());
            c.setPhone(body.getPhone());
            if (body.getSortOrder() != null) c.setSortOrder(body.getSortOrder());
            return ResponseEntity.ok(repository.save(clean(c)));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("@ss.can('HERDS')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        repository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    private static EmergencyContact clean(EmergencyContact c) {
        if (c.getName() == null || c.getName().isBlank()) throw new IllegalArgumentException("Enter a name.");
        // Keep digits and a leading + so the number dials as typed
        String phone = c.getPhone() == null ? "" : c.getPhone().trim().replaceAll("[^0-9+]", "");
        if (phone.replace("+", "").length() < 6) throw new IllegalArgumentException("Enter a phone number.");
        c.setName(c.getName().trim());
        c.setRole(c.getRole() == null || c.getRole().isBlank() ? null : c.getRole().trim());
        c.setPhone(phone);
        return c;
    }
}
