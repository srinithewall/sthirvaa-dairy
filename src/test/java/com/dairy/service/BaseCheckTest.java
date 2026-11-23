package com.dairy.service;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

class BaseCheckTest {

    @Test
    void aBaseWithinHalfABcsPointOfTheBandAgrees() {
        assertThat(BaseCheck.against(500, 475, 515, BaseCheck.TOLERANCE)).isEqualTo(BaseCheck.Status.OK);
        // 7% under the low end still agrees; further out does not
        assertThat(BaseCheck.against(442, 475, 515, BaseCheck.TOLERANCE)).isEqualTo(BaseCheck.Status.OK);
        assertThat(BaseCheck.against(440, 475, 515, BaseCheck.TOLERANCE)).isEqualTo(BaseCheck.Status.LOW);
        assertThat(BaseCheck.against(560, 475, 515, BaseCheck.TOLERANCE)).isEqualTo(BaseCheck.Status.HIGH);
    }

    @Test
    void girthComparesHerWithTheRestOfTheHerd() {
        // Three cows at 500 kg with 171-173 cm girth: a 182 cm cow is expected near 555 kg
        List<double[]> others = List.of(new double[]{500, 171}, new double[]{500, 172}, new double[]{500, 173});
        double est = BaseCheck.girthEstimate(182, others);
        assertThat(est).isCloseTo(500.0 / (172 * 172) * 182 * 182, within(0.01));
        assertThat(BaseCheck.against(500, est, est, BaseCheck.TOLERANCE)).isEqualTo(BaseCheck.Status.LOW);
        // ...and a 161 cm cow near 438 kg, so 480 reads high
        double small = BaseCheck.girthEstimate(161, others);
        assertThat(BaseCheck.against(480, small, small, BaseCheck.TOLERANCE)).isEqualTo(BaseCheck.Status.HIGH);
    }

    @Test
    void aGirthFromTheLastThreeMonthsOfPregnancyIsNotUsed() {
        assertThat(BaseCheck.girthShowsFrame(null)).isTrue();
        assertThat(BaseCheck.girthShowsFrame(150)).isTrue();
        assertThat(BaseCheck.girthShowsFrame(190)).isFalse();
    }

    @Test
    void girthNeedsAtLeastTwoOtherCows() {
        assertThat(BaseCheck.girthEstimate(170, List.of(new double[]{500, 172}))).isNull();
        assertThat(BaseCheck.girthEstimate(0, List.of(new double[]{500, 172}, new double[]{500, 171}))).isNull();
    }
}
