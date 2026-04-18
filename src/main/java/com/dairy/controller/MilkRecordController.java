package com.dairy.controller;

import com.dairy.model.MilkRecord;
import com.dairy.service.MilkRecordService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/milk-records")
public class MilkRecordController {

    @Autowired
    private MilkRecordService milkRecordService;

    /** GET /api/milk-records - all records */
    @GetMapping
    public List<MilkRecord> getAll() {
        return milkRecordService.getAll();
    }

    /** GET /api/milk-records/summary - aggregated daily summary  */
    @GetMapping("/summary")
    public List<Map<String, Object>> getDailySummary() {
        return milkRecordService.getDailySummary();
    }

    /** GET /api/milk-records/by-date?date=2024-04-23 */
    @GetMapping("/by-date")
    public List<MilkRecord> getByDate(
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return milkRecordService.getByDate(date);
    }

    /**
     * POST /api/milk-records/batch
     * Body: [{ herdId, date, shift, quantity }, ...]
     */
    @PostMapping("/batch")
    public ResponseEntity<List<MilkRecord>> saveBatch(
        @RequestBody List<Map<String, Object>> entries) {
        List<MilkRecord> saved = milkRecordService.saveBatch(entries);
        return ResponseEntity.ok(saved);
    }
}
