package com.dairy.service;

import com.dairy.model.FarmActivityLog;

/**
 * A rule that can tell, from the data alone, whether a chore has in fact been carried out.
 *
 * Only routines with a machine-checkable definition of done have one of these. A chore like
 * "clean the shed" leaves no trace to test, so it stays a manual tick.
 */
public interface ChoreCompletionCheck {

    /** The system routine this rule belongs to. */
    String systemKey();

    /** True when the work behind this occurrence is already recorded as finished. */
    boolean isSatisfied(FarmActivityLog log);

    /** Short note stored on the chore when this rule closes it. */
    String completionNote(FarmActivityLog log);
}
