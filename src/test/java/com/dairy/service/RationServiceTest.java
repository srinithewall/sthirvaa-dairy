package com.dairy.service;

import com.dairy.dto.ration.RationAnimalDTO;
import com.dairy.dto.ration.RationGroupDTO;
import com.dairy.model.ration.RationPlacement;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class RationServiceTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 11, 20);

    private static RationAnimalDTO animal(long id, String status, Double milk, Integer dim, Integer ageMonths) {
        RationAnimalDTO a = new RationAnimalDTO();
        a.setId(id);
        a.setAnimalStatus(status);
        a.setMilkPerDay(milk);
        a.setDim(dim);
        a.setAgeMonths(ageMonths);
        return a;
    }

    private static RationGroupDTO group(long id, List<String> statuses, Double minMilk, Double maxMilk,
                                        Integer minAge, Integer maxAge) {
        RationGroupDTO g = new RationGroupDTO();
        g.setId(id);
        RationGroupDTO.Rule r = new RationGroupDTO.Rule();
        r.setStatuses(statuses);
        r.setMinMilk(minMilk);
        r.setMaxMilk(maxMilk);
        r.setMinAgeMonths(minAge);
        r.setMaxAgeMonths(maxAge);
        g.setRule(r);
        return g;
    }

    @Test
    void emptyRuleMatchesNoOne() {
        assertThat(RationService.matches(new RationGroupDTO.Rule(), animal(1, "LACTATING", 20.0, 60, 50))).isFalse();
        assertThat(RationService.matches(null, animal(1, "LACTATING", 20.0, 60, 50))).isFalse();
    }

    @Test
    void statusAndMilkRangeBothMustHold() {
        RationGroupDTO.Rule peak = group(1, List.of("LACTATING"), 20.0, null, null, null).getRule();
        assertThat(RationService.matches(peak, animal(1, "LACTATING", 24.0, 60, 50))).isTrue();
        assertThat(RationService.matches(peak, animal(2, "LACTATING", 20.0, 60, 50))).isTrue(); // bounds inclusive
        assertThat(RationService.matches(peak, animal(3, "LACTATING", 19.9, 60, 50))).isFalse();
        assertThat(RationService.matches(peak, animal(4, "DRY", 24.0, 60, 50))).isFalse();
    }

    @Test
    void rangeOnAMissingFactFails() {
        RationGroupDTO.Rule calves = group(1, List.of("CALF"), null, null, null, 6).getRule();
        assertThat(RationService.matches(calves, animal(1, "CALF", null, null, null))).isFalse();
        assertThat(RationService.matches(calves, animal(2, "CALF", null, null, 3))).isTrue();
    }

    @Test
    void firstMatchingBatchWinsAndPinsOverrideRules() {
        RationGroupDTO peak = group(1, List.of("LACTATING"), 20.0, null, null, null);
        RationGroupDTO mid = group(2, List.of("LACTATING"), 12.0, 22.0, null, null);
        RationGroupDTO calf = group(3, List.of("CALF"), null, null, null, 6);
        RationGroupDTO manual = group(4, List.of(), null, null, null, null);

        RationAnimalDTO lakshmi = animal(10, "LACTATING", 21.0, 80, 60); // meets peak and mid: peak is first
        RationAnimalDTO ganga = animal(11, "LACTATING", 15.0, 150, 60);
        RationAnimalDTO brownie = animal(12, "CALF", null, null, 9);    // too old for the calf batch, no match
        RationAnimalDTO radha = animal(13, "LACTATING", 25.0, 300, 70); // rules say peak, pinned to manual

        List<RationAnimalDTO> animals = List.of(lakshmi, ganga, brownie, radha);
        RationService.assign(List.of(peak, mid, calf, manual), animals, Map.of(13L, 4L, 99L, 2L), Map.of(), TODAY);

        assertThat(peak.getHerdIds()).containsExactly(10L);
        assertThat(mid.getHerdIds()).containsExactly(11L);
        assertThat(calf.getHerdIds()).isEmpty();
        assertThat(manual.getHerdIds()).containsExactly(13L);
        assertThat(manual.getPinnedHerdIds()).containsExactly(13L);

        assertThat(brownie.getGroupId()).isNull();
        assertThat(radha.isPinned()).isTrue();
        assertThat(radha.getRuleGroupId()).isEqualTo(1L);
        assertThat(lakshmi.isPinned()).isFalse();
    }

    @Test
    void pinToADeletedBatchFallsBackToRules() {
        RationGroupDTO mid = group(2, List.of("LACTATING"), 12.0, 22.0, null, null);
        RationAnimalDTO ganga = animal(11, "LACTATING", 15.0, 150, 60);
        RationService.assign(List.of(mid), List.of(ganga), Map.of(11L, 77L), Map.of(), TODAY);
        assertThat(ganga.getGroupId()).isEqualTo(2L);
        assertThat(ganga.isPinned()).isFalse();
    }

    private static RationPlacement placed(long herdId, long groupId, LocalDate since) {
        RationPlacement p = new RationPlacement();
        p.setHerdId(herdId);
        p.setGroupId(groupId);
        p.setSince(since);
        return p;
    }

    private final RationGroupDTO mid = group(2, List.of("LACTATING"), 8.7, 14.7, null, null);
    private final RationGroupDTO late = group(3, List.of("LACTATING"), null, 8.6, null, null);
    private final RationGroupDTO dry = group(4, List.of("DRY"), null, null, null, null);

    @Test
    void newlyPlacedAnimalIsRecorded() {
        RationAnimalDTO ganga = animal(11, "LACTATING", 9.6, 177, 25);
        Map<Long, Long> moves = RationService.assign(List.of(mid, late), List.of(ganga), Map.of(), Map.of(), TODAY);
        assertThat(ganga.getGroupId()).isEqualTo(2L);
        assertThat(ganga.getInBatchSince()).isEqualTo(TODAY);
        assertThat(moves).containsEntry(11L, 2L);
    }

    @Test
    void cowMovedRecentlyIsHeldInHerBatch() {
        // Moved to Mid 3 days ago; her milk has dipped to Late's range.
        RationAnimalDTO ganga = animal(11, "LACTATING", 8.4, 180, 25);
        Map<Long, Long> moves = RationService.assign(List.of(mid, late), List.of(ganga), Map.of(),
                Map.of(11L, placed(11, 2, TODAY.minusDays(3))), TODAY);
        assertThat(ganga.getGroupId()).isEqualTo(2L);
        assertThat(ganga.getRuleGroupId()).isEqualTo(3L);
        assertThat(ganga.getHeldUntil()).isEqualTo(TODAY.plusDays(4));
        assertThat(mid.getHerdIds()).containsExactly(11L);
        assertThat(moves).isEmpty();
    }

    @Test
    void holdEndsAfterSevenDays() {
        RationAnimalDTO ganga = animal(11, "LACTATING", 8.4, 180, 25);
        Map<Long, Long> moves = RationService.assign(List.of(mid, late), List.of(ganga), Map.of(),
                Map.of(11L, placed(11, 2, TODAY.minusDays(7))), TODAY);
        assertThat(ganga.getGroupId()).isEqualTo(3L);
        assertThat(ganga.getHeldUntil()).isNull();
        assertThat(moves).containsEntry(11L, 3L);
    }

    @Test
    void statusChangeMovesAtOnce() {
        // Dried off the day after joining Mid: goes to the dry batch straight away.
        RationAnimalDTO ganga = animal(11, "DRY", null, 181, 25);
        RationService.assign(List.of(mid, late, dry), List.of(ganga), Map.of(),
                Map.of(11L, placed(11, 2, TODAY.minusDays(1))), TODAY);
        assertThat(ganga.getGroupId()).isEqualTo(4L);
        assertThat(ganga.getHeldUntil()).isNull();
    }

    @Test
    void pinOverridesAHold() {
        RationAnimalDTO ganga = animal(11, "LACTATING", 8.4, 180, 25);
        Map<Long, Long> moves = RationService.assign(List.of(mid, late), List.of(ganga), Map.of(11L, 3L),
                Map.of(11L, placed(11, 2, TODAY.minusDays(1))), TODAY);
        assertThat(ganga.getGroupId()).isEqualTo(3L);
        assertThat(ganga.isPinned()).isTrue();
        assertThat(moves).isEmpty();
    }
}
