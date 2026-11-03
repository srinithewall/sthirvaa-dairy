package com.dairy.service;

import com.dairy.model.FarmActivityLog;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;

/**
 * The onboarding chore is finished when no newly arrived animal has a step due. On days with
 * nothing to do - or no animal in quarantine - it closes itself, so nobody is nudged for nothing.
 */
@Component
public class OnboardingCompletionCheck implements ChoreCompletionCheck {

    @Autowired
    @Lazy
    private OnboardingService onboardingService;

    @Override
    public String systemKey() {
        return SystemRoutineInitializer.ANIMAL_ONBOARDING_KEY;
    }

    @Override
    public boolean isSatisfied(FarmActivityLog log) {
        return onboardingService.countDue() == 0;
    }

    @Override
    public String completionNote(FarmActivityLog log) {
        return "Completed automatically - no onboarding step is due.";
    }
}
