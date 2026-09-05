package com.dairy.service;

import com.dairy.dto.WeightRoundRow;
import com.dairy.model.FarmActivityLog;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;

/**
 * The weight round is done when every active animal has a reading dated on or after the day the
 * chore was due. That covers readings entered one animal at a time from the animal cards, not
 * just the batch save on the round screen.
 */
@Component
public class HerdWeightRoundCompletionCheck implements ChoreCompletionCheck {

    @Autowired
    @Lazy
    private HerdWeightService weightService;

    @Override
    public String systemKey() {
        return SystemRoutineInitializer.HERD_WEIGHT_KEY;
    }

    @Override
    public boolean isSatisfied(FarmActivityLog log) {
        LocalDate roundDate = log.getDueDate() != null ? log.getDueDate() : LocalDate.now();
        List<WeightRoundRow> rows = weightService.getWeightRound(roundDate);
        if (rows.isEmpty()) return false;

        for (WeightRoundRow row : rows) {
            if (!row.isMeasuredInRound()) return false;
        }
        return true;
    }

    @Override
    public String completionNote(FarmActivityLog log) {
        return "Completed automatically - every animal has a reading for this round.";
    }
}
