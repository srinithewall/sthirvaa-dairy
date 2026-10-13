package com.dairy.dto.optimizer;

import java.util.List;

/**
 * POST /api/feed-plans/{planId}/adequacy.
 *
 * animalIds is optional: omit it to check the animals already assigned, or pass a
 * candidate set to preview how the ration would suit animals before assigning them.
 */
public class AdequacyRequestDTO {

    private List<Long> animalIds;

    public List<Long> getAnimalIds() { return animalIds; }
    public void setAnimalIds(List<Long> animalIds) { this.animalIds = animalIds; }
}
