package com.dairy.service;

import com.dairy.model.FarmActivityLog;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;

/**
 * The deworming chore is finished when no animal is due. On a day when nothing is due it closes
 * itself, so staff are only reminded when there is something to do.
 */
@Component
public class HerdDewormingCompletionCheck implements ChoreCompletionCheck {

    @Autowired
    @Lazy
    private DewormingService dewormingService;

    @Override
    public String systemKey() {
        return SystemRoutineInitializer.HERD_DEWORMING_KEY;
    }

    @Override
    public boolean isSatisfied(FarmActivityLog log) {
        return dewormingService.countDue() == 0;
    }

    @Override
    public String completionNote(FarmActivityLog log) {
        return "Completed automatically - no animal is due for deworming.";
    }
}
