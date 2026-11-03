package com.dairy.controller;

import com.dairy.service.CostTrackerService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.Map;

/** Cost tracker report: farm costs in a date range grouped by cost parameter (feed, vet, deaths ...). Read-only. */
@RestController
@RequestMapping("/api/reports/costs")
public class CostTrackerController {
    @Autowired
    private CostTrackerService costTrackerService;

    @GetMapping
    public Map<String, Object> getCosts(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "ALL") String segment) {
        if (to.isBefore(from)) { LocalDate t = from; from = to; to = t; }
        return costTrackerService.summary(from, to, segment);
    }
}
