package com.dairy.controller;

import com.dairy.dto.WeightRoundResult;
import com.dairy.dto.WeightRoundRow;
import com.dairy.model.HerdWeightRecord;
import com.dairy.service.HerdWeightService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

/**
 * The herd-wide weight round: every active animal on one screen, one save for the batch.
 * Separate from HerdWeightController, which stays per-animal.
 */
@RestController
@RequestMapping("/api/herds/weight")
public class HerdWeightRoundController {

    @Autowired
    private HerdWeightService weightService;

    @GetMapping("/round")
    public List<WeightRoundRow> getRound(
            @RequestParam(value = "date", required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return weightService.getWeightRound(date);
    }

    /**
     * Saves a batch of readings. Pass the chore's logId so a round that now covers every animal
     * closes the task without staff having to confirm it separately.
     */
    @PostMapping("/bulk")
    public WeightRoundResult saveBulk(
            @RequestBody List<HerdWeightRecord> records,
            @RequestParam(value = "logId", required = false) Long logId,
            @RequestParam(value = "date", required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return weightService.addWeightRecords(records, logId, date);
    }
}
