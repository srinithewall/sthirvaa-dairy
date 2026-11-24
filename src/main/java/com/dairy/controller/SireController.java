package com.dairy.controller;

import com.dairy.model.SireBull;
import com.dairy.repo.SireBullRepository;
import com.dairy.service.SireAnalysisService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/** Sire (AI bull) catalogue and the per-animal sire analysis shown on the AI Service tab. */
@RestController
public class SireController {

    private final SireBullRepository repo;
    private final SireAnalysisService analysis;

    public SireController(SireBullRepository repo, SireAnalysisService analysis) {
        this.repo = repo;
        this.analysis = analysis;
    }

    /** GET /api/sires?category=CATTLE — the whole catalogue, best pedigrees first. */
    @GetMapping("/api/sires")
    public List<SireBull> list(@RequestParam(required = false) String category) {
        return repo.findAll().stream()
                .filter(s -> category == null || category.isBlank()
                        || category.equalsIgnoreCase(s.getCategory()))
                .sorted(Comparator.comparing(SireBull::getBullNo))
                .toList();
    }

    @GetMapping("/api/sires/{bullNo}")
    public ResponseEntity<SireBull> one(@PathVariable String bullNo) {
        return repo.findByBullNo(bullNo.trim().toUpperCase(Locale.ROOT))
                .map(ResponseEntity::ok).orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/api/sires")
    public ResponseEntity<?> create(@RequestBody SireBull s) {
        if (s.getBullNo() == null || s.getBullNo().isBlank())
            return ResponseEntity.badRequest().body(Map.of("message", "Bull number is required"));
        s.setBullNo(s.getBullNo().trim().toUpperCase(Locale.ROOT));
        if (repo.findByBullNo(s.getBullNo()).isPresent())
            return ResponseEntity.badRequest().body(Map.of("message", "Bull " + s.getBullNo() + " already exists"));
        s.setId(null);
        return ResponseEntity.ok(repo.save(s));
    }

    @PutMapping("/api/sires/{id}")
    public ResponseEntity<SireBull> update(@PathVariable Long id, @RequestBody SireBull s) {
        return repo.findById(id).map(e -> {
            s.setId(id);
            s.setBullNo(s.getBullNo() == null ? e.getBullNo() : s.getBullNo().trim().toUpperCase(Locale.ROOT));
            return ResponseEntity.ok(repo.save(s));
        }).orElse(ResponseEntity.notFound().build());
    }

    /**
     * GET /api/herds/{id}/sire-analysis[?bull=HF-40421]
     * Bull from the cow's latest AI record, or the given bull to preview before AI.
     */
    @GetMapping("/api/herds/{id}/sire-analysis")
    public ResponseEntity<?> analyse(@PathVariable Long id, @RequestParam(required = false) String bull) {
        try {
            return ResponseEntity.ok(analysis.analyse(id, bull));
        } catch (NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        }
    }
}
