package com.dairy.controller;

import com.dairy.dto.HerdWeightHistory;
import com.dairy.dto.HerdWeightOverviewRow;
import com.dairy.service.HerdWeightHistoryService;
import com.dairy.service.HerdWeightService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Herd weight overview for Analytics & Reports. Under /api/reports so it follows the
 * Dashboard permission like the rest of that screen.
 */
@RestController
@RequestMapping("/api/reports/herd-weights")
public class HerdWeightReportController {

    @Autowired
    private HerdWeightService weightService;

    /** Every active animal's current weight against its breed/age target, with its latest BCS. */
    @GetMapping
    public List<HerdWeightOverviewRow> getOverview() {
        return weightService.getOverview();
    }

    @Autowired
    private HerdWeightHistoryService historyService;

    /** One animal's readings oldest first, each with the healthy weight for that day, and its milk by month. */
    @GetMapping("/{herdId}/history")
    public ResponseEntity<HerdWeightHistory> getHistory(@PathVariable Long herdId) {
        return historyService.getHistory(herdId).map(ResponseEntity::ok).orElse(ResponseEntity.notFound().build());
    }
}
