package com.dairy.controller;

import com.dairy.model.HerdWeightRecord;
import com.dairy.service.HerdWeightService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/herds/{herdId}/weight")
public class HerdWeightController {

    @Autowired
    private HerdWeightService weightService;

    @GetMapping
    public List<HerdWeightRecord> getHistory(@PathVariable Long herdId) {
        return weightService.getWeightHistory(herdId);
    }

    @PostMapping
    public HerdWeightRecord addRecord(@PathVariable Long herdId, @RequestBody HerdWeightRecord record) {
        record.setHerdId(herdId);
        return weightService.addWeightRecord(record);
    }

    /**
     * Corrects one reading - its date, girth, length or kg (fields left out stay as they are).
     * 404 when the reading is not this animal's; 409 when she already has a reading on the new date.
     */
    @PutMapping("/{id}")
    public ResponseEntity<?> updateRecord(@PathVariable Long herdId, @PathVariable Long id, @RequestBody HerdWeightRecord changes) {
        try {
            return weightService.updateWeightRecord(herdId, id, changes)
                    .<ResponseEntity<?>>map(ResponseEntity::ok)
                    .orElse(ResponseEntity.notFound().build());
        } catch (IllegalStateException e) {
            return ResponseEntity.status(409).body(e.getMessage());
        }
    }
}
