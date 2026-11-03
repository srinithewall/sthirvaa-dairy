package com.dairy.controller;

import com.dairy.service.MilkProjectionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/** EMP report: estimated milk production and revenue for the coming months, from each animal's own records. Read-only. */
@RestController
@RequestMapping("/api/reports/emp")
public class MilkProjectionController {
    @Autowired
    private MilkProjectionService milkProjectionService;

    @GetMapping
    public Map<String, Object> getProjection(@RequestParam(defaultValue = "9") int months) {
        return milkProjectionService.project(Math.max(1, Math.min(months, 12)));
    }
}
