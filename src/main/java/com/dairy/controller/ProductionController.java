package com.dairy.controller;

import com.dairy.model.Production;
import com.dairy.service.ProductionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/production")
public class ProductionController {
    @Autowired
    private ProductionService productionService;

    @GetMapping
    public List<Production> getAllProductions() {
        return productionService.getAllProductions();
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public Production createProduction(@RequestBody Production production) {
        return productionService.saveProduction(production);
    }
}
