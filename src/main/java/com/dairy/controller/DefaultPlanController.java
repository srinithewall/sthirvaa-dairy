package com.dairy.controller;

import com.dairy.dto.optimizer.DefaultPlanResponseDTO;
import com.dairy.service.optimizer.DefaultPlanService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/** GET /api/feeds/default-plan?animalId= - matches the already-built frontend's call (dairy-ui/app/feeds/components/FeedOptimizerTab.tsx). */
@RestController
@RequestMapping("/api/feeds")
public class DefaultPlanController {

    @Autowired
    private DefaultPlanService defaultPlanService;

    @GetMapping("/default-plan")
    public ResponseEntity<DefaultPlanResponseDTO> getDefaultPlan(@RequestParam Long animalId,
                                                                  @RequestParam(required = false) String stage) {
        return ResponseEntity.ok(defaultPlanService.calculate(animalId, stage));
    }
}
