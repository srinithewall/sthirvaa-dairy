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
            @RequestParam(defaultValue = "ALL") String segment,
            @RequestParam(defaultValue = "false") boolean includeUnaccounted,
            @RequestParam(defaultValue = "false") boolean includeCattlePurchases) {
        if (to.isBefore(from)) { LocalDate t = from; from = to; to = t; }
        Map<String, Object> out = costTrackerService.summary(from, to, segment, includeUnaccounted);
        // Investment, not expense: listed apart so the expense totals are unchanged. Poultry has none.
        if (includeCattlePurchases) {
            out.put("cattlePurchases", "POULTRY".equalsIgnoreCase(segment) ? java.util.List.of() : costTrackerService.cattlePurchases(from, to));
        }
        return out;
    }
}
