package com.dairy.controller;

import com.dairy.model.AnimalRequirement;
import com.dairy.service.FeedOptimizerService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/animal-requirements")
public class AnimalRequirementController {

    @Autowired
    private FeedOptimizerService optimizerService;

    @GetMapping
    public ResponseEntity<List<AnimalRequirement>> getAllRequirements() {
        return ResponseEntity.ok(optimizerService.getAllRequirements());
    }

    @GetMapping("/{stage}")
    public ResponseEntity<AnimalRequirement> getRequirementByStage(@PathVariable String stage) {
        return optimizerService.getRequirementByStage(stage)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
