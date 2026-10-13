package com.dairy.dto.optimizer;

import jakarta.validation.constraints.NotNull;

import java.util.List;

/**
 * PUT /api/feed-plans/{planId}/assignments.
 *
 * REPLACES the assigned set rather than adding to it - the UI is a checkbox list, so
 * send-what-is-ticked maps directly onto what the user sees and is idempotent on retry.
 * An empty list unassigns every animal and leaves the plan as an unused template.
 */
public class AssignPlanRequestDTO {

    @NotNull
    private List<Long> animalIds;

    public List<Long> getAnimalIds() { return animalIds; }
    public void setAnimalIds(List<Long> animalIds) { this.animalIds = animalIds; }
}
