package com.dairy.controller;

import com.dairy.service.EfficiencyService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/** Efficiency report: reproduction, milk target and lactation per cow (see EfficiencyService). */
@RestController
@RequestMapping("/api/reports/efficiency")
public class EfficiencyController {
    @Autowired
    private EfficiencyService efficiencyService;

    @GetMapping
    public Map<String, Object> getReport() {
        return efficiencyService.report();
    }

    /**
     * Sets a cow's milk target from today's figure ({"litres": 24}); the app keeps it moving along her
     * lactation curve and pregnancy. {"litres": null} goes back to the breed estimate.
     */
    @PatchMapping("/cows/{id}/target")
    @PreAuthorize("@ss.can('HERDS')")
    public ResponseEntity<?> setTarget(@PathVariable Long id, @RequestBody java.util.Map<String, Double> body) {
        Double litres = body.get("litres");
        if (litres != null && (litres <= 0 || litres > 80)) return ResponseEntity.badRequest().body("Target must be between 0 and 80 L");
        return efficiencyService.setTarget(id, litres) ? ResponseEntity.ok().build() : ResponseEntity.notFound().build();
    }
}
