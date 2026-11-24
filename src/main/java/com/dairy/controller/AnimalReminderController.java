package com.dairy.controller;

import com.dairy.dto.AnimalReminderRow;
import com.dairy.service.AnimalReminderService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Animal reminders that have fallen due - the work list behind the "Animal health reminders" chore. */
@RestController
@RequestMapping("/api/herds/reminders")
public class AnimalReminderController {

    @Autowired
    private AnimalReminderService reminderService;

    @GetMapping("/due")
    public List<AnimalReminderRow> getDue() {
        return reminderService.getDue();
    }
}
