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
 * Ration plan: feeding batches, the animals in each (placed by the batch rules from herd data, or
 * pinned by hand), and the plan period used for the purchase list.
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
        return rationService.view();
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

    /** Body: { herdId, groupId } - pins the animal to that batch; groupId null hands it back to the batch rules. */
    @PreAuthorize(MANAGE)
    @PutMapping("/members")
    public ResponseEntity<Void> setMember(@RequestBody Map<String, Long> body) {
        rationService.setMember(body.get("herdId"), body.get("groupId"));
        return ResponseEntity.noContent().build();
    }

    /** Body: { herdIds: [...] } - hands these animals back to the batch rules. */
    @PreAuthorize(MANAGE)
    @PostMapping("/members/unpin")
    public ResponseEntity<Void> unpin(@RequestBody Map<String, List<Long>> body) {
        rationService.unpin(body.getOrDefault("herdIds", List.of()));
        return ResponseEntity.noContent().build();
    }

    @PreAuthorize(MANAGE)
    @PutMapping("/plan")
    public RationPlan savePlan(@RequestBody RationPlan plan) {
        return rationService.savePlan(plan);
    }
}
