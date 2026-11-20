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

        double preg = WeightTarget.gravidUterusKg(550, 250);
        WeightTarget.Result r = WeightTarget.of(HC, today.minusYears(4), "DRY", 3, 250, 600.0, 2.0, null, today);
        assertThat(r.pregnancyKg()).isEqualTo(Math.round(preg));
        assertThat(r.breedTargetKg()).isEqualTo(Math.round(550 + preg));
        // only her own tissue is corrected for condition; the calf is added back as it is
        assertThat(r.frameTargetKg()).isEqualTo(Math.round((600 - preg) / 0.863 + preg));
        assertThat(r.basis()).contains("pregnancy (day 250)");
    }

    @Test
    void theCalfIsTakenOutAtItsSizeOnTheWeighingDay() {
        // Weighed 12 days ago at day 212; today she is at day 224
        LocalDate weighed = today.minusDays(12);
        double then = WeightTarget.gravidUterusKg(550, 212);
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
