package com.dairy.dto.ration;

import com.dairy.model.ration.RationItem;
import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

/**
 * A batch with its ration lines, its rule and the animals in it.
 *
 * On read, herdIds is everyone in the batch today (put there by hand or by the rule) and
 * pinnedHerdIds the ones put there by hand. On save, items replace the batch's lines, rule
 * (if sent) replaces its rule, and herdIds (if sent) replaces the animals pinned to it by hand.
 */
@Getter
@Setter
public class RationGroupDTO {
    private Long id;
    private String name;
    private String color;
    private String notes;
    private Integer sortOrder;
    private List<RationItem> items = new ArrayList<>();
    private List<Long> herdIds;
    private List<Long> pinnedHerdIds;
    private Rule rule;
    /** Milk per day (L) the lines are written for; drives scaleWithMilk lines. */
    private Double refMilk;

    /** Which animals the batch takes automatically. Unset parts don't limit; an empty rule takes no one. */
    @Getter
    @Setter
    public static class Rule {
        private List<String> statuses = new ArrayList<>();
        private Double minMilk;
        private Double maxMilk;
        private Integer minDim;
        private Integer maxDim;
        private Integer minAgeMonths;
        private Integer maxAgeMonths;

        @com.fasterxml.jackson.annotation.JsonIgnore
        public boolean isEmpty() {
            return (statuses == null || statuses.isEmpty()) && minMilk == null && maxMilk == null
                    && minDim == null && maxDim == null && minAgeMonths == null && maxAgeMonths == null;
        }
    }
}
