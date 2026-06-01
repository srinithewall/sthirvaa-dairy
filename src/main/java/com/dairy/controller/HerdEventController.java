package com.dairy.controller;

import com.dairy.model.HerdEvent;
import com.dairy.repo.HerdEventRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/herds")
public class HerdEventController {

    @Autowired
    private HerdEventRepository herdEventRepository;

    @GetMapping("/{herdId}/events")
    public ResponseEntity<List<HerdEvent>> getEventsByHerd(@PathVariable Long herdId) {
        List<HerdEvent> events = herdEventRepository.findByHerdIdOrderByEventDateDesc(herdId);
        return ResponseEntity.ok(events);
    }

    @PostMapping("/{herdId}/events")
    @PreAuthorize("@ss.can('HERDS')")
    public ResponseEntity<HerdEvent> createEvent(@PathVariable Long herdId, @RequestBody HerdEvent event) {
        event.setHerdId(herdId);
        HerdEvent saved = herdEventRepository.save(event);
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/events/{id}")
    @PreAuthorize("@ss.can('HERDS')")
    public ResponseEntity<Void> deleteEvent(@PathVariable Long id) {
        if (!herdEventRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        herdEventRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
