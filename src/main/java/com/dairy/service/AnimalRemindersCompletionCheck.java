package com.dairy.service;

import com.dairy.model.FarmActivityLog;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;

/**
 * The animal reminders chore is finished when no reminder is due. On days with nothing due it
 * closes itself, so staff are only nudged when an animal needs something done.
 */
@Component
public class AnimalRemindersCompletionCheck implements ChoreCompletionCheck {

    @Autowired
    @Lazy
    private AnimalReminderService reminderService;

    @Override
    public String systemKey() {
        return SystemRoutineInitializer.ANIMAL_REMINDERS_KEY;
    }

    @Override
    public boolean isSatisfied(FarmActivityLog log) {
        return reminderService.countDue() == 0;
    }

    @Override
    public String completionNote(FarmActivityLog log) {
        return "Completed automatically - no animal reminder is due.";
    }
}
