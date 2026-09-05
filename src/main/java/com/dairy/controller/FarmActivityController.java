package com.dairy.controller;

import com.dairy.model.ActivityStatus;
import com.dairy.model.FarmActivity;
import com.dairy.model.FarmActivityLog;
import com.dairy.service.FarmActivityService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/activities")
public class FarmActivityController {

    @Autowired
    private FarmActivityService activityService;

    // --- Routines ---

    @GetMapping("/templates")
    public List<FarmActivity> getTemplates() {
        return activityService.getAllActiveActivities();
    }

    @GetMapping("/templates/{id}")
    public FarmActivity getTemplate(@PathVariable Long id) {
        return activityService.getActivity(id);
    }

    @PostMapping("/templates")
    public FarmActivity createTemplate(@RequestBody FarmActivity activity) {
        return activityService.saveActivity(activity);
    }

    @PutMapping("/templates/{id}")
    public FarmActivity updateTemplate(@PathVariable Long id, @RequestBody FarmActivity activity) {
        return activityService.updateActivity(id, activity);
    }

    @DeleteMapping("/templates/{id}")
    public ResponseEntity<Void> deleteTemplate(@PathVariable Long id) {
        activityService.deactivateActivity(id);
        return ResponseEntity.noContent().build();
    }

    /** Past and upcoming occurrences of one routine - the tracking history. */
    @GetMapping("/templates/{id}/history")
    public List<FarmActivityLog> getTemplateHistory(@PathVariable Long id) {
        return activityService.getHistoryForActivity(id);
    }

    // --- Occurrences ---

    @GetMapping("/logs")
    public List<FarmActivityLog> getLogsForDate(
            @RequestParam("date") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(name = "includeOverdue", defaultValue = "false") boolean includeOverdue) {
        return includeOverdue
                ? activityService.getLogsForDateIncludingOverdue(date)
                : activityService.getLogsForDate(date);
    }

    @GetMapping("/logs/range")
    public List<FarmActivityLog> getLogsForRange(
            @RequestParam("start") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate start,
            @RequestParam("end") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate end) {
        return activityService.getLogsBetween(start, end);
    }

    @GetMapping("/logs/{id}")
    public FarmActivityLog getLog(@PathVariable Long id) {
        return activityService.getLog(id);
    }

    /** The actionable list: due today, plus anything still open from earlier days. */
    @GetMapping("/today")
    public List<FarmActivityLog> getLogsForToday() {
        return activityService.getLogsForDateIncludingOverdue(LocalDate.now());
    }

    @PatchMapping("/logs/{id}/status")
    public FarmActivityLog updateLogStatus(
            @PathVariable Long id,
            @RequestBody Map<String, Object> updates
    ) {
        ActivityStatus status = ActivityStatus.valueOf((String) updates.get("status"));
        Long staffId = updates.get("staffId") != null ? ((Number) updates.get("staffId")).longValue() : null;
        String notes = updates.containsKey("notes") ? (String) updates.get("notes") : null;
        return activityService.updateLogStatus(id, status, staffId, notes);
    }

    @PatchMapping("/logs/{id}/assign")
    public FarmActivityLog assignLog(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        Long staffId = body.get("staffId") != null ? ((Number) body.get("staffId")).longValue() : null;
        return activityService.assignLog(id, staffId);
    }

    @ExceptionHandler(FarmActivityService.RoutineNotEditableException.class)
    public ResponseEntity<Map<String, String>> handleNotEditable(FarmActivityService.RoutineNotEditableException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", ex.getMessage()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleNotFound(IllegalArgumentException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", ex.getMessage()));
    }
}
