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

    @Autowired
    private com.dairy.service.HerdService herdService;

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
            // A BCS reading's title is derived from its score, so only its date and notes change
            boolean isBcs = com.dairy.service.HerdService.BCS_EVENT.equals(event.getEventType());
            if (!isBcs && body.getTitle() != null && !body.getTitle().isBlank()) event.setTitle(body.getTitle());
            event.setDetails(body.getDetails());
            HerdEvent saved = herdEventRepository.save(event);
            // A moved BCS reading can change which one is latest
            if (com.dairy.service.HerdService.BCS_EVENT.equals(saved.getEventType())) herdService.syncBcs(saved.getHerdId());
            return ResponseEntity.ok(saved);
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/events/{id}")
    @PreAuthorize("@ss.can('HERDS')")
    public ResponseEntity<Void> deleteEvent(@PathVariable Long id) {
        HerdEvent event = herdEventRepository.findById(id).orElse(null);
        if (event == null) {
            return ResponseEntity.notFound().build();
        }
        herdEventRepository.deleteById(id);
        // Deleting a BCS reading falls back to the previous one
        if (com.dairy.service.HerdService.BCS_EVENT.equals(event.getEventType())) herdService.syncBcs(event.getHerdId());
        return ResponseEntity.noContent().build();
    }
}
