package com.dairy.controller;

import com.dairy.dto.DewormingEntry;
import com.dairy.dto.DewormingRoundResult;
import com.dairy.dto.DewormingRoundRow;
import com.dairy.service.DewormingService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** The herd-wide deworming round: every animal with its last and next dose, one save for the ticked ones. */
@RestController
@RequestMapping("/api/herds/deworming")
public class DewormingRoundController {

    @Autowired
    private DewormingService dewormingService;

    @GetMapping("/round")
    public List<DewormingRoundRow> getRound() {
        return dewormingService.getRound();
    }

    @PostMapping("/bulk")
    @PreAuthorize("@ss.can('HERDS')")
    public DewormingRoundResult saveBulk(
            @RequestBody List<DewormingEntry> entries,
            @RequestParam(value = "logId", required = false) Long logId) {
        return dewormingService.saveBulk(entries, logId);
    }
}
