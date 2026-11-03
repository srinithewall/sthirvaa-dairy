package com.dairy.controller;

import com.dairy.model.onboarding.AnimalOnboarding;
import com.dairy.service.OnboardingService;
import com.fasterxml.jackson.annotation.JsonFormat;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

/** Settling-in of newly arrived animals: quarantine, vet check, parasite control, feed change-over. */
@RestController
@RequestMapping("/api/onboarding")
public class OnboardingController {

    public record StartRequest(Long herdId, @JsonFormat(pattern = "yyyy-MM-dd") LocalDate arrivalDate,
                               Integer quarantineDays, String notes) {}

    /** answers: the choices tapped; notes: anything else typed in "Other". */
    public record StepRequest(String status, @JsonFormat(pattern = "yyyy-MM-dd") LocalDate doneDate,
                              List<String> answers, String notes) {}

    @Autowired
    private OnboardingService onboardingService;

    @GetMapping
    public List<AnimalOnboarding> list() {
        return onboardingService.list();
    }

    @GetMapping("/herd/{herdId}")
    public ResponseEntity<AnimalOnboarding> forHerd(@PathVariable Long herdId) {
        return onboardingService.forHerd(herdId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.noContent().build());
    }

    @PostMapping
    @PreAuthorize("@ss.can('HERDS')")
    public AnimalOnboarding start(@RequestBody StartRequest body) {
        if (body.herdId() == null) throw new IllegalArgumentException("Pick the animal to onboard.");
        return onboardingService.start(body.herdId(), body.arrivalDate(), body.quarantineDays(), body.notes());
    }

    @PutMapping("/{id}")
    @PreAuthorize("@ss.can('HERDS')")
    public AnimalOnboarding update(@PathVariable Long id, @RequestBody StartRequest body) {
        return onboardingService.update(id, body.arrivalDate(), body.quarantineDays(), body.notes());
    }

    @PatchMapping("/steps/{stepId}")
    @PreAuthorize("@ss.can('HERDS')")
    public AnimalOnboarding updateStep(@PathVariable Long stepId, @RequestBody StepRequest body,
                                       @RequestParam(value = "logId", required = false) Long logId) {
        return onboardingService.updateStep(stepId, body.status(), body.doneDate(), body.answers(), body.notes(), logId);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("@ss.can('HERDS')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        onboardingService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
