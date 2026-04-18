package com.dairy.controller;

import com.dairy.model.MilkDispatch;
import com.dairy.service.MilkDispatchService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/milk-dispatch")
public class MilkDispatchController {

    @Autowired
    private MilkDispatchService service;

    /** GET /api/milk-dispatch/by-date?date=2026-04-18 */
    @GetMapping("/by-date")
    public List<MilkDispatch> getByDate(
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return service.getByDate(date);
    }

    /**
     * POST /api/milk-dispatch/session
     * Body: [{ date, shift, dispatchType, customerId, quantity, ratePerLitre }, ...]
     * Replaces existing records for that date+shift and recalculates income.
     */
    @PostMapping("/session")
    public ResponseEntity<List<MilkDispatch>> saveSession(
        @RequestBody List<Map<String, Object>> entries) {
        return ResponseEntity.ok(service.saveSession(entries));
    }
}
