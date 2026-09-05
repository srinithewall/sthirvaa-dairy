package com.dairy.controller;

import com.dairy.dto.optimizer.PlanDetailDTO;
import com.dairy.dto.optimizer.PlanSummaryDTO;
import com.dairy.dto.optimizer.SavePlanRequestDTO;
import com.dairy.dto.optimizer.UpdatePlanRequestDTO;
import com.dairy.service.optimizer.CustomPlanService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Custom Plan save/list/load - matches the already-built frontend's /feed-plans calls. */
@RestController
@RequestMapping("/api/feed-plans")
public class FeedPlanController {

    @Autowired
    private CustomPlanService customPlanService;

    @PostMapping
    public ResponseEntity<PlanSummaryDTO> savePlan(@Valid @RequestBody SavePlanRequestDTO request) {
        return ResponseEntity.ok(customPlanService.savePlan(request));
    }

    @GetMapping
    public ResponseEntity<List<PlanSummaryDTO>> listPlans(@RequestParam Long animalId) {
        return ResponseEntity.ok(customPlanService.listPlans(animalId));
    }

    @GetMapping("/{planId}")
    public ResponseEntity<PlanDetailDTO> loadPlan(@PathVariable Long planId) {
        return ResponseEntity.ok(customPlanService.loadPlan(planId));
    }

    @PutMapping("/{planId}")
    public ResponseEntity<PlanSummaryDTO> updatePlan(@PathVariable Long planId,
                                                     @Valid @RequestBody UpdatePlanRequestDTO request) {
        return ResponseEntity.ok(customPlanService.updatePlan(planId, request));
    }

    @DeleteMapping("/{planId}")
    public ResponseEntity<Void> deletePlan(@PathVariable Long planId) {
        customPlanService.deletePlan(planId);
        return ResponseEntity.noContent().build();
    }
}
