package com.dairy.service;

import com.dairy.model.Breed;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

class WeightTargetTest {

    private final LocalDate today = LocalDate.of(2026, 11, 20);

    private static Breed breed(String name, double belowAvgMax, double avgMax) {
        Breed b = new Breed();
        b.setName(name);
        b.setBelowAvgMax(belowAvgMax);
        b.setAvgMax(avgMax);
        return b;
    }

    private static final Breed HC = breed("Holstein Cross", 550, 650);
    private static final Breed HF75 = breed("Holstein 75%", 500, 650);
    private static final Breed JERSEY = breed("Jersey", 420, 480);

    @Test
    void grownCowWithoutABcsIsHeldToHerBreedMinimum() {
        WeightTarget.Result r = WeightTarget.of(HC, today.minusYears(5), "LACTATING", 3, null, 480.0, null, null, today);
        assertThat(r.targetKg()).isEqualTo(550);
        assertThat(r.frameTargetKg()).isNull();
        assertThat(r.grown()).isTrue();
    }

    @Test
    void aGrownCowWithABcsIsHeldToHerOwnFrameNotHerBreed() {
        // Labelled pure HF (600 kg) but smaller: 410 kg at BCS 2 is about 475 kg at BCS 3
        WeightTarget.Result r = WeightTarget.of(breed("Holstein Friesian", 600, 700), today.minusYears(4), "LACTATING", 2, null, 410.0, 2.0, null, today);
        assertThat(r.targetKg()).isEqualTo(Math.round(410 / 0.863));
        assertThat(r.breedTargetKg()).isEqualTo(600);
    }

    @Test
    void aBigFramedCowScoredThinGetsAHigherTargetThanHerBreed() {
        // 550 kg is above the Holstein 75% minimum (500), but at BCS 2 her bones show:
        // at BCS 3 she would weigh 550 / (1 - 0.137) = 637 kg
        WeightTarget.Result r = WeightTarget.of(HF75, today.minusYears(5), "LACTATING", 3, null, 550.0, 2.0, null, today);
        assertThat(r.frameTargetKg()).isEqualTo(Math.round(550 / 0.863));
        assertThat(r.targetKg()).isEqualTo(r.frameTargetKg());
        assertThat(r.basis()).startsWith("Her frame");
    }

    @Test
    void aGrownCowInIdealConditionIsAtHerHealthyWeight() {
        WeightTarget.Result cow = WeightTarget.of(HF75, today.minusYears(5), "LACTATING", 3, null, 550.0, 3.0, null, today);
        assertThat(cow.targetKg()).isEqualTo(550);
    }

    @Test
    void weightLostAfterTheScoreShowsAsAShortfallNotALowerMinimum() {
        // Scored BCS 3 against a 550 kg weighing; three weeks later the scale reads 530 kg.
        WeightTarget.Weighing scored = new WeightTarget.Weighing(today.minusDays(15), 550, true);
        WeightTarget.Result r = WeightTarget.of(HF75, today.minusYears(5), "LACTATING", 3, null,
                530.0, 3.0, today, scored, today);
        assertThat(r.targetKg()).isEqualTo(550);
        assertThat(r.targetKg() - 530).isEqualTo(20);
        assertThat(r.basis()).isEqualTo("Her frame: 550 kg on 5 Nov at the ideal BCS 3 is her healthy weight");
    }

    @Test
    void aBaseMinimumIsTheSameWhateverHerScore() {
        for (double bcs : new double[]{1, 2, 2.5, 3, 4, 5}) {
            WeightTarget.Result r = WeightTarget.of(HF75, today.minusYears(5), "LACTATING", 3, null,
                    438.0, bcs, today, null, 470.0, today);
            assertThat(r.targetKg()).as("BCS %s", bcs).isEqualTo(470);
        }
        WeightTarget.Result r = WeightTarget.of(HF75, today.minusYears(5), "LACTATING", 3, null, 438.0, 2.5, today, null, 470.0, today);
        assertThat(r.basis()).isEqualTo("Her base minimum 470 kg");
    }

    @Test
    void pregnancyIsAddedToTheBaseOneWeekAtATime() {
        // Same week (days 182-188): same minimum. Next week: higher.
        double wk26 = WeightTarget.of(HF75, today.minusYears(5), "LACTATING", 3, 182, 500.0, 3.0, today, null, 470.0, today).targetKg();
        double wk26late = WeightTarget.of(HF75, today.minusYears(5), "LACTATING", 3, 188, 500.0, 3.0, today, null, 470.0, today).targetKg();
        double wk27 = WeightTarget.of(HF75, today.minusYears(5), "LACTATING", 3, 189, 500.0, 3.0, today, null, 470.0, today).targetKg();
        assertThat(wk26).isEqualTo(wk26late).isEqualTo(Math.round(470 + WeightTarget.gravidUterusKg(470, 182)));
        assertThat(wk27).isGreaterThan(wk26);
        // Near term the calf adds tens of kg
        double term = WeightTarget.of(HF75, today.minusYears(5), "DRY", 3, 280, 500.0, 3.0, today, null, 470.0, today).targetKg();
        assertThat(term - 470).isGreaterThan(40);
    }

    @Test
    void youngStockIgnoreABaseAndFollowTheGrowthCurve() {
        WeightTarget.Result r = WeightTarget.of(HC, today.minusMonths(14), "HEIFER", 0, null, 300.0, 3.0, today, null, 470.0, today);
        assertThat(r.targetKg()).isEqualTo(Math.round(550 * WeightTarget.curveShare(java.time.temporal.ChronoUnit.DAYS.between(today.minusMonths(14), today))));
    }

    @Test
    void theSundayCheckExpectsTheBaseMovedByHerScore() {
        assertThat(WeightTarget.expectedAtBcs(470, 3, null)).isEqualTo(470);
        assertThat(WeightTarget.expectedAtBcs(470, 2.5, null)).isCloseTo(470 * 0.9315, within(0.01));
        assertThat(WeightTarget.expectedAtBcs(470, 4, null)).isCloseTo(470 * 1.137, within(0.01));
        assertThat(WeightTarget.expectedAtBcs(470, 3, 252)).isCloseTo(470 + WeightTarget.gravidUterusKg(470, 252), within(0.01));
    }

    @Test
    void theFrameWeighingIsTheScaleReadingNearestTheScore() {
        LocalDate scored = LocalDate.of(2026, 10, 27);
        WeightTarget.Weighing tapeBefore = new WeightTarget.Weighing(LocalDate.of(2026, 10, 18), 444, false);
        WeightTarget.Weighing scaleAfter = new WeightTarget.Weighing(LocalDate.of(2026, 11, 8), 550, true);
        WeightTarget.Weighing scaleLater = new WeightTarget.Weighing(LocalDate.of(2026, 11, 23), 530, true);
        // A scale reading within the window beats a closer tape one; the nearest scale reading wins.
        assertThat(WeightTarget.frameWeighing(java.util.List.of(tapeBefore, scaleAfter, scaleLater), scored)).isEqualTo(scaleAfter);
        // Only tape near the score: the nearest tape reading.
        assertThat(WeightTarget.frameWeighing(java.util.List.of(tapeBefore), scored)).isEqualTo(tapeBefore);
        // Nothing within the window: the nearest weighing of all.
        WeightTarget.Weighing far = new WeightTarget.Weighing(LocalDate.of(2026, 6, 1), 500, true);
        WeightTarget.Weighing farther = new WeightTarget.Weighing(LocalDate.of(2026, 3, 1), 480, true);
        assertThat(WeightTarget.frameWeighing(java.util.List.of(farther, far), scored)).isEqualTo(far);
        // Equally near either side: the earlier one.
        WeightTarget.Weighing before = new WeightTarget.Weighing(scored.minusDays(5), 500, true);
        WeightTarget.Weighing after = new WeightTarget.Weighing(scored.plusDays(5), 505, true);
        assertThat(WeightTarget.frameWeighing(java.util.List.of(after, before), scored)).isEqualTo(before);
        assertThat(WeightTarget.frameWeighing(java.util.List.of(before), null)).isNull();
    }

    @Test
    void heifersKeepTheGrowthCurveAndOnlyAThinScoreRaisesIt() {
        // Good condition never lowers the curve: a heifer can be well covered and still small
        WeightTarget.Result fine = WeightTarget.of(HC, today.minusMonths(7), "HEIFER", 0, null, 120.0, 3.5, null, today);
        assertThat(fine.frameTargetKg()).isNull();
        assertThat(fine.targetKg()).isEqualTo(fine.breedTargetKg());
        // Thin and already over the curve: her frame figure takes over
        WeightTarget.Result thin = WeightTarget.of(HC, today.minusMonths(7), "HEIFER", 0, null, 250.0, 2.0, null, today);
        assertThat(thin.targetKg()).isEqualTo(Math.round(250 / 0.863));
        assertThat(thin.grown()).isFalse();
    }

    @Test
    void bcsCorrectionFollowsNrc() {
        assertThat(WeightTarget.atIdealBcs(500, 3)).isEqualTo(500);
        assertThat(WeightTarget.atIdealBcs(500, 2.5)).isCloseTo(500 / 0.9315, within(0.01));
        assertThat(WeightTarget.atIdealBcs(500, 4)).isCloseTo(500 / 1.137, within(0.01));
    }

    @Test
    void heiferFollowsTheGrowthCurve() {
        // 14 months is breeding size: 55% of the grown weight
        WeightTarget.Result r = WeightTarget.of(HC, today.minusDays(426), "HEIFER", 0, null, null, null, null, today);
        assertThat(r.targetKg()).isEqualTo(Math.round(550 * 0.55));
        assertThat(r.grown()).isFalse();
        // A newborn starts at about 7%
        assertThat(WeightTarget.of(HC, today, "CALF", 0, null, null, null, null, today).targetKg()).isEqualTo(Math.round(550 * 0.07));
    }

    @Test
    void curveIsStraightBetweenItsPoints() {
        // half-way from 14 months (55%) to 24 months (85%)
        assertThat(WeightTarget.curveShare(578)).isCloseTo(0.70, within(0.001));
        assertThat(WeightTarget.curveShare(5000)).isEqualTo(1.0);
    }

    @Test
    void aCowThatHasCalvedIsNeverBelowFirstCalvingWeight() {
        WeightTarget.Result r = WeightTarget.of(JERSEY, today.minusMonths(20), "LACTATING", 1, null, null, null, null, today);
        assertThat(r.targetKg()).isEqualTo(Math.round(420 * 0.85));
        assertThat(r.grown()).isTrue();
    }

    @Test
    void pregnancyIsAddedButKeptOutOfTheBcsCorrection() {
        // NRC 2001: tiny early on, ~75 kg at term for a 600 kg breed
        assertThat(WeightTarget.gravidUterusKg(600, 100)).isLessThan(3);
        assertThat(WeightTarget.gravidUterusKg(600, 190)).isCloseTo(12.6, within(1.0));
        assertThat(WeightTarget.gravidUterusKg(600, 280)).isCloseTo(0.06275 * 600 * 1.825, within(0.01));
        assertThat(WeightTarget.gravidUterusKg(600, null)).isZero();

        // Day 255 counts as week 36 (day 252): the allowance steps up once a week
        double preg = WeightTarget.gravidUterusKg(550, 252);
        WeightTarget.Result r = WeightTarget.of(HC, today.minusYears(4), "DRY", 3, 255, 600.0, 2.0, null, today);
        assertThat(r.pregnancyKg()).isEqualTo(Math.round(preg));
        assertThat(r.breedTargetKg()).isEqualTo(Math.round(550 + preg));
        // only her own tissue is corrected for condition; the calf is added back as it is
        assertThat(r.frameTargetKg()).isEqualTo(Math.round((600 - preg) / 0.863 + preg));
        assertThat(r.basis()).contains("pregnancy (week 36)");
    }

    @Test
    void theCalfIsTakenOutAtItsSizeOnTheWeighingDay() {
        // Weighed 14 days ago at day 210 (week 30); today she is at day 224 (week 32)
        LocalDate weighed = today.minusDays(14);
        double then = WeightTarget.gravidUterusKg(550, 210);
        double now = WeightTarget.gravidUterusKg(550, 224);
        WeightTarget.Result r = WeightTarget.of(HC, today.minusYears(4), "DRY", 3, 224, 540.0, 2.0, weighed, today);
        assertThat(r.frameTargetKg()).isEqualTo(Math.round((540 - then) / 0.863 + now));
        assertThat(r.pregnancyKg()).isEqualTo(Math.round(now));
        // Conceived after the weighing: nothing to take out
        assertThat(WeightTarget.daysPregnantOn(10, today.minusDays(12), today)).isNull();
        assertThat(WeightTarget.daysPregnantOn(224, null, today)).isEqualTo(224);
    }

    @Test
    void noTargetForAYoungAnimalWithoutABirthDate() {
        assertThat(WeightTarget.of(JERSEY, null, "CALF", 0, null, 80.0, 3.0, null, today)).isNull();
        // ...but a milking cow without one is taken as grown
        assertThat(WeightTarget.of(JERSEY, null, "LACTATING", null, null, null, null, null, today).targetKg()).isEqualTo(420);
    }

    @Test
    void noTargetWithoutABreedBand() {
        assertThat(WeightTarget.of(null, today.minusYears(4), "DRY", 2, null, 500.0, 3.0, null, today)).isNull();
        assertThat(WeightTarget.of(new Breed(), today.minusYears(4), "DRY", 2, null, 500.0, 3.0, null, today)).isNull();
    }
}
