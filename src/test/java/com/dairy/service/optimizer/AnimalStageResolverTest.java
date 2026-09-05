package com.dairy.service.optimizer;

import com.dairy.model.Herd;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

class AnimalStageResolverTest {

    private AnimalStageResolver resolver;

    @BeforeEach
    void setUp() {
        resolver = new AnimalStageResolver();
        StageMappingProperties props = new StageMappingProperties(); // defaults: fresh<=15, early<=100, peak<=150, mid<=200
        setField(resolver, props);
    }

    private static void setField(AnimalStageResolver resolver, StageMappingProperties props) {
        try {
            var field = AnimalStageResolver.class.getDeclaredField("stageMapping");
            field.setAccessible(true);
            field.set(resolver, props);
        } catch (ReflectiveOperationException e) {
            throw new RuntimeException(e);
        }
    }

    private Herd herd(String status, Integer dim, LocalDate birthDate) {
        Herd h = new Herd();
        h.setAnimalStatus(status);
        h.setDim(dim);
        h.setBirthDate(birthDate);
        return h;
    }

    @Test
    void lactating_freshCow_withinFreshWindow() {
        assertThat(resolver.resolveStage(herd("LACTATING", 10, null))).isEqualTo("Fresh Cow");
    }

    @Test
    void lactating_earlyLactation() {
        assertThat(resolver.resolveStage(herd("LACTATING", 50, null))).isEqualTo("Early Lactation");
    }

    @Test
    void lactating_peakLactation() {
        assertThat(resolver.resolveStage(herd("LACTATING", 120, null))).isEqualTo("Peak Lactation");
    }

    @Test
    void lactating_midLactation() {
        assertThat(resolver.resolveStage(herd("LACTATING", 180, null))).isEqualTo("Mid Lactation");
    }

    @Test
    void lactating_lateLactation() {
        assertThat(resolver.resolveStage(herd("LACTATING", 250, null))).isEqualTo("Late Lactation");
    }

    @Test
    void lactating_noDimOnRecord_defaultsToEarlyLactation() {
        assertThat(resolver.resolveStage(herd("LACTATING", null, null))).isEqualTo("Early Lactation");
    }

    @Test
    void pregnant_resolvesToPregnantHeifer() {
        assertThat(resolver.resolveStage(herd("PREGNANT", null, null))).isEqualTo("Pregnant Heifer");
    }

    @Test
    void dry_resolvesToDryCow() {
        assertThat(resolver.resolveStage(herd("DRY", null, null))).isEqualTo("Dry Cow");
    }

    @Test
    void calf_underThreeMonths() {
        assertThat(resolver.resolveStage(herd("CALF", null, LocalDate.now().minusDays(60)))).isEqualTo("3 Month Calf");
    }

    @Test
    void calf_betweenThreeAndSixMonths() {
        assertThat(resolver.resolveStage(herd("CALF", null, LocalDate.now().minusDays(150)))).isEqualTo("6 Month Calf");
    }

    @Test
    void heifer_overSixMonths_resolvesToOneYearHeifer() {
        assertThat(resolver.resolveStage(herd("HEIFER", null, LocalDate.now().minusDays(300)))).isEqualTo("1 Year Heifer");
    }
}
