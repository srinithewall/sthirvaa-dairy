package com.dairy.service;

import com.dairy.model.HerdEvent;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;

/**
 * Where an animal is in its breeding cycle, read from its event history.
 *
 * Only breeding events after the latest calving count: an insemination from before the calf was
 * born belongs to the pregnancy that just ended. A confirmed pregnancy dates from the insemination
 * that led to it (the latest one on or before the PD), not from the PD itself - the check is
 * weeks after conception. An unconfirmed insemination is taken as the conception until a PD or a
 * later insemination says otherwise.
 */
public record BreedingCycle(LocalDate lastCalving, LocalDate conception, LocalDate pdDate, int inseminations) {

    static final Set<String> CALVING_TYPES = Set.of("CALVING", "CALF_DELIVERED");
    static final Set<String> AI_TYPES = Set.of("SEMEN_GIVEN", "AI_DONE");
    static final String PD_TYPE = "PREGNANCY_CONFIRMED";

    /** Events in any order; only those dated on or before {@code today} are read. */
    public static BreedingCycle of(List<HerdEvent> events, LocalDate today) {
        LocalDate calving = null, lactationStart = null;
        for (HerdEvent e : events) {
            LocalDate d = e.getEventDate();
            if (d == null || d.isAfter(today) || e.getEventType() == null) continue;
            String type = e.getEventType().toUpperCase();
            if (CALVING_TYPES.contains(type) && (calving == null || d.isAfter(calving))) calving = d;
            if ("LACTATION_STARTED".equals(type) && (lactationStart == null || d.isAfter(lactationStart))) lactationStart = d;
        }
        // A lactation recorded without a calving (a cow bought in milk) still starts a cycle.
        if (calving == null) calving = lactationStart;

        LocalDate lastAi = null, lastPd = null;
        int count = 0;
        for (HerdEvent e : events) {
            LocalDate d = e.getEventDate();
            if (d == null || d.isAfter(today) || e.getEventType() == null) continue;
            if (calving != null && !d.isAfter(calving)) continue;
            String type = e.getEventType().toUpperCase();
            if (AI_TYPES.contains(type)) {
                count++;
                if (lastAi == null || d.isAfter(lastAi)) lastAi = d;
            } else if (PD_TYPE.equals(type) && (lastPd == null || d.isAfter(lastPd))) {
                lastPd = d;
            }
        }

        LocalDate conception;
        if (lastPd != null && (lastAi == null || !lastAi.isAfter(lastPd))) {
            // Confirmed: the insemination before the check, or the check itself if none was recorded.
            conception = lastAi != null ? lastAi : lastPd;
        } else {
            // Not confirmed, or inseminated again after the last check (that pregnancy was lost).
            conception = lastAi;
            lastPd = null;
        }
        return new BreedingCycle(calving, conception, lastPd, count);
    }

    public boolean pregnant() { return conception != null; }

    public boolean confirmed() { return pdDate != null; }
}
