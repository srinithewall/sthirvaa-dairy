package com.dairy.controller;

import com.dairy.service.EfficiencyService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/** Efficiency report: reproduction, milk target and lactation per cow (see EfficiencyService). Read-only. */
@RestController
@RequestMapping("/api/reports/efficiency")
public class EfficiencyController {
    @Autowired
    private EfficiencyService efficiencyService;

    @GetMapping
    public Map<String, Object> getReport() {
        return efficiencyService.report();
    }
}
