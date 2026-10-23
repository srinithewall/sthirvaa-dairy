package com.dairy.controller;

import com.dairy.model.AmcsCollection;
import com.dairy.service.AmcsClient;
import com.dairy.service.AmcsCollectionService;
import com.dairy.service.AmcsSyncService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/amcs")
public class AmcsCollectionController {

    @Autowired
    private AmcsCollectionService amcsCollectionService;

    @Autowired
    private AmcsSyncService amcsSyncService;

    /**
     * POST /api/amcs/import
     * Body: the AMCS "data" array as returned by the society app, e.g.
     * [{ memberCode, collectionDate, shiftCode, sampleNo, quantity, fat, snf, clr, rate, amount, ... }]
     */
    @PostMapping("/import")
    public ResponseEntity<Map<String, Object>> importRows(@RequestBody List<Map<String, Object>> rows) {
        return ResponseEntity.ok(amcsCollectionService.importRows(rows));
    }

    /**
     * POST /api/amcs/sync?days=7 - fetch the last N days from AMCS now and import them.
     * The same thing the twice-daily job does; for checking a deployment or catching up.
     * AMCS problems come back as 502, never 401, which the UI treats as "logged out".
     */
    @PostMapping("/sync")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> syncNow(@RequestParam(defaultValue = "7") int days) {
        int clamped = Math.min(Math.max(days, 1), 60);
        try {
            return ResponseEntity.ok(amcsSyncService.sync(clamped));
        } catch (AmcsClient.AmcsAuthException | AmcsClient.AmcsUnavailableException ex) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(Map.of(
                "error", ex.getMessage(),
                "tokenRejected", ex instanceof AmcsClient.AmcsAuthException));
        }
    }

    /** GET /api/amcs/collections?from=2026-10-01&to=2026-10-24 */
    @GetMapping("/collections")
    public List<AmcsCollection> getCollections(
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return amcsCollectionService.getBetween(from, to);
    }
}
