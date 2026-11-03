package com.dairy.controller;

import com.dairy.dto.ration.RationGroupDTO;
import com.dairy.model.ration.RationPlan;
import com.dairy.service.RationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Ration plan: feeding batches, the animals in each, and the plan period used for the purchase list.
 * Everyone signed in can read it (staff feed from it); only ADMIN and PARTNER change it.
 */
@RestController
@RequestMapping("/api/ration")
public class RationController {
    private static final String MANAGE = "hasAnyRole('ADMIN','PARTNER')";

    @Autowired
    private RationService rationService;

    @GetMapping
    public Map<String, Object> get() {
        return Map.of("plan", rationService.getPlan(), "groups", rationService.listGroups());
    }

    @PreAuthorize(MANAGE)
    @PostMapping("/groups")
    public RationGroupDTO create(@RequestBody RationGroupDTO group) {
        return rationService.saveGroup(null, group);
    }

    @PreAuthorize(MANAGE)
    @PutMapping("/groups/{id}")
    public RationGroupDTO update(@PathVariable Long id, @RequestBody RationGroupDTO group) {
        return rationService.saveGroup(id, group);
    }

    @PreAuthorize(MANAGE)
    @DeleteMapping("/groups/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        rationService.deleteGroup(id);
        return ResponseEntity.noContent().build();
    }

    /** Body: { herdId, groupId } - groupId null takes the animal out of its batch. */
    @PreAuthorize(MANAGE)
    @PutMapping("/members")
    public ResponseEntity<Void> setMember(@RequestBody Map<String, Long> body) {
        rationService.setMember(body.get("herdId"), body.get("groupId"));
        return ResponseEntity.noContent().build();
    }

    @PreAuthorize(MANAGE)
    @PutMapping("/plan")
    public RationPlan savePlan(@RequestBody RationPlan plan) {
        return rationService.savePlan(plan);
    }
}
