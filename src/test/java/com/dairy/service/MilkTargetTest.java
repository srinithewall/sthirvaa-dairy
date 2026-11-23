package com.dairy.service;

import com.dairy.model.Herd;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

class MilkTargetTest {

    private static Herd cow(String breed, double weightKg) {
        Herd h = new Herd();
        h.setAnimalType("COW");
        h.setBreed(breed);
        h.setBirthDate(LocalDate.now().minusYears(5));
        h.setHeartGirth(180.0);
        h.setCalculatedWeight(weightKg);
        return h;
    }

    @Test
    void theTargetIsWhatSheCanGiveKeptHealthyNotWhatHerWeightAllows() {
        MilkPotentialService s = new MilkPotentialService();
        // Same cow, thin or well covered: the potential is the same.
        Integer thin = s.calculatePotential(cow("Holstein 65%", 380), 2).getPotential();
        Integer covered = s.calculatePotential(cow("Holstein 65%", 560), 2).getPotential();
        assertThat(thin).isEqualTo(covered).isEqualTo(18);
        // A Jersey's potential sits below an HF cross's.
        assertThat(s.calculatePotential(cow("Jersey", 450), 2).getPotential()).isLessThan(thin);
    }

    @Test
    void todaysTargetFollowsTheLactationCurve() {
        // About 26% above her lactation average at the peak, below it early and late.
        assertThat(EfficiencyService.curve(EfficiencyService.PEAK_DIM)).isCloseTo(1.26, within(0.02));
        assertThat(EfficiencyService.curve(null)).isEqualTo(1.0);
        assertThat(EfficiencyService.curve(5)).isLessThan(1.0);
        assertThat(EfficiencyService.curve(266)).isLessThan(EfficiencyService.curve(178)).isLessThan(1.0);
        // Averages 1 over a 305-day lactation.
        double sum = 0;
        for (int d = 1; d <= 305; d++) sum += EfficiencyService.curve(d);
        assertThat(sum / 305).isCloseTo(1.0, within(0.01));

        // An HF 75% cow (21 L average) near her peak should give about 26 L.
        Map<String, Object> m = EfficiencyService.milkTarget(19.3, 21, 61, null);
        double today = ((Number) m.get("targetPerDay")).doubleValue();
        assertThat(today).isCloseTo(26.4, within(0.5));
        assertThat(((Number) m.get("lostPerDay")).doubleValue()).isCloseTo(today - 19.3, within(0.06));
    }

    @Test
    void aCowAboveHerTargetHasNothingToGain() {
        Map<String, Object> m = EfficiencyService.milkTarget(30, 20, 60, null);
        assertThat(((Number) m.get("lostPerDay")).doubleValue()).isZero();
        assertThat(((Number) m.get("efficiency")).doubleValue()).isGreaterThan(100);
    }

    @Test
    void aMatureCowIsNotMarkedDownForHerAgeOnceHerLactationIsKnown() {
        MilkPotentialService s = new MilkPotentialService();
        Herd young = cow("Holstein 65%", 450);
        young.setBirthDate(LocalDate.now().minusYears(3));
        // 4th lactation: as mature as a 5-year-old, whatever the birth date says.
        assertThat(s.calculatePotential(young, 4).getPotential())
                .isEqualTo(s.calculatePotential(cow("Holstein 65%", 450), 4).getPotential());
    }

    @Test
    void laterPregnancyTakesMilkOff() {
        assertThat(EfficiencyService.pregnancy(null)).isEqualTo(1.0);
        assertThat(EfficiencyService.pregnancy(56)).isEqualTo(1.0);
        assertThat(EfficiencyService.pregnancy(180)).isCloseTo(0.925, within(0.001));
        assertThat(EfficiencyService.pregnancy(240)).isCloseTo(0.85, within(0.001));
        assertThat(EfficiencyService.pregnancy(270)).isCloseTo(0.85, within(0.001));
        double open = ((Number) EfficiencyService.milkTarget(8, 16, 216, null).get("targetPerDay")).doubleValue();
        double carrying = ((Number) EfficiencyService.milkTarget(8, 16, 216, 200).get("targetPerDay")).doubleValue();
        assertThat(carrying).isLessThan(open);
    }

    private static com.dairy.model.HerdEvent event(long herdId, LocalDate on, String type) {
        com.dairy.model.HerdEvent e = new com.dairy.model.HerdEvent();
        e.setHerdId(herdId);
        e.setEventDate(on);
        e.setEventType(type);
        return e;
    }

    @Test
    void theFullCycleUsesThisFarmsOwnDaysToConceiveAndDryPeriod() {
        LocalDate today = LocalDate.of(2026, 11, 23);
        Herd cow = new Herd();
        cow.setId(1L);
        LocalDate first = LocalDate.of(2025, 1, 1);
        LocalDate second = first.plusDays(420);          // 420-day interval: 140 days to conceive
        java.util.List<com.dairy.model.HerdEvent> events = java.util.List.of(
                event(1, second, "CALVING"), event(1, first, "CALVING"));
        java.util.TreeMap<LocalDate, Double> milk = new java.util.TreeMap<>();
        for (LocalDate d = first.plusDays(1); d.isBefore(second.minusDays(75)); d = d.plusDays(1)) milk.put(d, 10.0);
        for (LocalDate d = second.plusDays(1); !d.isAfter(today); d = d.plusDays(1)) milk.put(d, 10.0);

        EfficiencyService.FarmCycle farm = EfficiencyService.farmCycle(java.util.List.of(cow),
                Map.of(1L, events), Map.of(1L, milk), today);
        // 140 from the completed cycle; she is also open at day 271 now, at least that late.
        assertThat(farm.daysOpen()).isEqualTo(Math.round((140 + 271) / 2.0));
        assertThat(farm.dryDays()).isEqualTo(75);

        // No history: the targets stand in.
        EfficiencyService.FarmCycle none = EfficiencyService.farmCycle(java.util.List.of(),
                Map.of(), Map.of(), today);
        assertThat(none.daysOpen()).isEqualTo(EfficiencyService.TARGET_DAYS_OPEN);
        assertThat(none.dryDays()).isEqualTo(EfficiencyService.DRY_PERIOD_DAYS);
    }

    @Test
    void aTargetSetTodayKeepsFollowingHerCurveAndPregnancy() {
        // Farm says 24 L today at day 61; open.
        double potential = EfficiencyService.potentialFor(24, 61, null);
        assertThat(((Number) EfficiencyService.milkTarget(18, potential, 61, null).get("targetPerDay")).doubleValue())
                .isCloseTo(24, within(0.06));
        // A month later, past her peak, it eases off by itself.
        assertThat(((Number) EfficiencyService.milkTarget(18, potential, 120, null).get("targetPerDay")).doubleValue())
                .isLessThan(24);
        // Set while 6 months pregnant: today still reads as entered.
        double carrying = EfficiencyService.potentialFor(11, 216, 180);
        assertThat(((Number) EfficiencyService.milkTarget(8, carrying, 216, 180).get("targetPerDay")).doubleValue())
                .isCloseTo(11, within(0.06));
    }

    @Test
    void avgPerDayIsTheLastSevenDaysUpToToday() {
        LocalDate today = LocalDate.of(2026, 11, 23);
        java.util.TreeMap<LocalDate, Double> daily = new java.util.TreeMap<>();
        daily.put(today.minusDays(10), 30.0);   // older than a week: left out
        daily.put(today.minusDays(6), 18.0);
        daily.put(today.minusDays(3), 20.0);
        daily.put(today, 22.0);
        assertThat(EfficiencyService.lastDays(daily, today, 7)).isEqualTo(20.0);
        assertThat(EfficiencyService.lastDays(new java.util.TreeMap<>(), today, 7)).isZero();
    }
}
