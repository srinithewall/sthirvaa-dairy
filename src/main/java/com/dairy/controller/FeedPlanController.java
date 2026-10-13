package com.dairy.controller;

import com.dairy.dto.optimizer.AdequacyRequestDTO;
import com.dairy.dto.optimizer.AssignPlanRequestDTO;
import com.dairy.dto.optimizer.PlanAdequacyDTO;
import com.dairy.dto.optimizer.PlanDetailDTO;
import com.dairy.dto.optimizer.PlanSummaryDTO;
import com.dairy.dto.optimizer.SavePlanRequestDTO;
import com.dairy.dto.optimizer.UpdatePlanRequestDTO;
import com.dairy.service.optimizer.CustomPlanService;
import com.dairy.service.optimizer.PlanAdequacyService;
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

    @Autowired
    private PlanAdequacyService planAdequacyService;

    @PostMapping
    public ResponseEntity<PlanSummaryDTO> savePlan(@Valid @RequestBody SavePlanRequestDTO request) {
        return ResponseEntity.ok(customPlanService.savePlan(request));
    }

    /** animalId is optional now: omit it to list every plan, e.g. for a manage-plans view. */
    @GetMapping
    public ResponseEntity<List<PlanSummaryDTO>> listPlans(@RequestParam(required = false) Long animalId) {
        return ResponseEntity.ok(animalId != null
                ? customPlanService.listPlans(animalId)
                : customPlanService.listAllPlans());
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

    /** Replaces (not appends to) the set of animals this plan applies to. */
    @PutMapping("/{planId}/assignments")
    public ResponseEntity<PlanDetailDTO> replaceAssignments(@PathVariable Long planId,
                                                            @Valid @RequestBody AssignPlanRequestDTO request) {
        return ResponseEntity.ok(customPlanService.replaceAssignments(planId, request));
    }

    /**
     * Whether this plan's ration actually suits each animal. Body is optional: omit it to
     * check the assigned animals, or pass animalIds to preview candidates before assigning.
     */
    @PostMapping("/{planId}/adequacy")
    public ResponseEntity<List<PlanAdequacyDTO>> adequacy(@PathVariable Long planId,
                                                          @RequestBody(required = false) AdequacyRequestDTO request) {
        return ResponseEntity.ok(planAdequacyService.evaluate(
                planId, request != null ? request.getAnimalIds() : null));
    }
}
