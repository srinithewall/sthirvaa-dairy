package com.dairy.controller;

import com.dairy.model.HerdWeightRecord;
import com.dairy.service.HerdWeightService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/herds/{herdId}/weight")
public class HerdWeightController {

    @Autowired
    private HerdWeightService weightService;

    @GetMapping
    public List<HerdWeightRecord> getHistory(@PathVariable Long herdId) {
        return weightService.getWeightHistory(herdId);
    }

    @PostMapping
    public HerdWeightRecord addRecord(@PathVariable Long herdId, @RequestBody HerdWeightRecord record) {
        record.setHerdId(herdId);
        return weightService.addWeightRecord(record);
    }
}
