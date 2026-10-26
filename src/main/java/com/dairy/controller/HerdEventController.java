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

    @GetMapping("/events/all")
    public ResponseEntity<List<HerdEvent>> getAllEvents() {
        List<HerdEvent> events = herdEventRepository.findAllByOrderByEventDateDesc();
        return ResponseEntity.ok(events);
    }

    @PostMapping("/{herdId}/events")
    @PreAuthorize("@ss.can('HERDS')")
    public ResponseEntity<HerdEvent> createEvent(@PathVariable Long herdId, @RequestBody HerdEvent event) {
        event.setHerdId(herdId);
        HerdEvent saved = herdEventRepository.save(event);
        return ResponseEntity.ok(saved);
    }

    /** Edits date, title and details; the herd and event type stay as recorded. */
    @PutMapping("/events/{id}")
    @PreAuthorize("@ss.can('HERDS')")
    public ResponseEntity<HerdEvent> updateEvent(@PathVariable Long id, @RequestBody HerdEvent body) {
        return herdEventRepository.findById(id).map(event -> {
            if (body.getEventDate() != null) event.setEventDate(body.getEventDate());
            if (body.getTitle() != null && !body.getTitle().isBlank()) event.setTitle(body.getTitle());
            event.setDetails(body.getDetails());
            return ResponseEntity.ok(herdEventRepository.save(event));
        }).orElse(ResponseEntity.notFound().build());
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
