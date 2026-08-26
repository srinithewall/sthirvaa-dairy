package com.dairy.controller;

import com.dairy.dto.FeedOptimizerRequestDTO;
import com.dairy.dto.FeedOptimizerResponseDTO;
import com.dairy.service.FeedOptimizerService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/feeds/optimize")
public class FeedOptimizerController {

    @Autowired
    private FeedOptimizerService optimizerService;

    @PostMapping
    public ResponseEntity<FeedOptimizerResponseDTO> optimizeRation(@RequestBody FeedOptimizerRequestDTO request) {
        try {
            FeedOptimizerResponseDTO response = optimizerService.optimizeRation(request);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }
}
