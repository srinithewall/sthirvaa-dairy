package com.dairy.controller;

import com.dairy.model.SemenCatalog;
import com.dairy.repository.SemenCatalogRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.List;

@RestController
@RequestMapping("/api/semen-catalog")
public class SemenCatalogController {

    @Autowired
    private SemenCatalogRepository repo;

    /**
     * GET /api/semen-catalog?animalType=COW
     * Returns all active semen entries for the given animal type (+ ANY).
     * Falls back to all active entries if no animalType is provided.
     */
    @GetMapping
    public ResponseEntity<List<SemenCatalog>> getAll(
            @RequestParam(required = false) String animalType) {

        List<SemenCatalog> result;
        if (animalType != null && !animalType.isBlank()) {
            result = repo.findByStatusAndAnimalTypeIn(
                    "ACTIVE",
                    Arrays.asList(animalType.toUpperCase(), "ANY"));
        } else {
            result = repo.findByStatus("ACTIVE");
        }
        return ResponseEntity.ok(result);
    }

    /** POST /api/semen-catalog  (admin: add new entry) */
    @PostMapping
    public ResponseEntity<SemenCatalog> create(@RequestBody SemenCatalog entry) {
        entry.setStatus("ACTIVE");
        return ResponseEntity.ok(repo.save(entry));
    }

    /** PUT /api/semen-catalog/{id} */
    @PutMapping("/{id}")
    public ResponseEntity<SemenCatalog> update(
            @PathVariable Long id, @RequestBody SemenCatalog entry) {
        return repo.findById(id)
                .map(existing -> {
                    entry.setId(id);
                    return ResponseEntity.ok(repo.save(entry));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    /** DELETE /api/semen-catalog/{id} (soft delete) */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        repo.findById(id).ifPresent(e -> {
            e.setStatus("INACTIVE");
            repo.save(e);
        });
        return ResponseEntity.noContent().build();
    }
}
