package com.dairy.controller;

import com.dairy.model.Herd;
import com.dairy.service.HerdService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/herds")
public class HerdController {
    @Autowired
    private HerdService herdService;

    @GetMapping
    public ResponseEntity<?> getAllHerds() {
        List<com.dairy.model.Herd> herds = herdService.getAllHerds();
        
        // Use null-safe grouping for animal types
        java.util.Map<String, Long> animalCounts = herds.stream()
                .filter(h -> h.getAnimalType() != null)
                .collect(java.util.stream.Collectors.groupingBy(
                    com.dairy.model.Herd::getAnimalType, 
                    java.util.stream.Collectors.counting()
                ));
        
        java.util.Map<String, Object> counts = new java.util.HashMap<>(animalCounts);
        
        // Add Specific Counts (Lactation and Calf)
        counts.put("Lactation", herds.stream().filter(h -> Boolean.TRUE.equals(h.isLactating())).count());
        counts.put("Calf", herds.stream().filter(h -> Boolean.TRUE.equals(h.isCalf())).count());
        
        java.util.Map<String, Object> response = new java.util.HashMap<>();
        response.put("herds", herds);
        response.put("counts", counts);
        response.put("total", (long) herds.size());
        
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Herd> getHerdById(@PathVariable Long id) {
        return herdService.getHerdById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/type/{animalType}")
    public List<Herd> getHerdsByType(@PathVariable String animalType) {
        return herdService.getHerdsByAnimalType(animalType);
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public Herd createHerd(@RequestBody Herd herd) {
        return herdService.saveHerd(herd);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Herd> updateHerd(@PathVariable Long id, @RequestBody Herd herd) {
        return herdService.getHerdById(id)
                .map(existing -> {
                    herd.setId(id);
                    return ResponseEntity.ok(herdService.saveHerd(herd));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteHerd(@PathVariable Long id) {
        herdService.deleteHerd(id);
        return ResponseEntity.noContent().build();
    }
}
