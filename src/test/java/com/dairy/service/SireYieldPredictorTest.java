package com.dairy.service;

import com.dairy.config.SireCatalogSeederAccess;
import com.dairy.model.SireBull;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class SireYieldPredictorTest {

    private static SireYieldPredictor.Inputs in(Double damAvg, int days, Double pedigree, Double breedMean) {
        return new SireYieldPredictor.Inputs(8.0, damAvg, damAvg == null ? null : damAvg * 1.4, days, 1.3,
                pedigree, breedMean, null, null, 65.0, 100.0);
    }

    @Test
    void premiumBullOnAverageCowLiftsAboveFarmAverage() {
        var r = SireYieldPredictor.predict(in(8.0, 120, 14400.0, 10000.0));
        // sire effect = 8 × ½ × 0.3 × 0.44 = 0.528
        assertEquals(0.5, r.sireEffectL(), 0.01);
        assertEquals(0.0, r.damEffectL(), 0.01);
        assertEquals(8.5, r.avgDailyL(), 0.05);
        assertEquals(44.0, r.sireMeritPct(), 0.01);
        assertEquals(82.5, r.daughterExoticPct(), 0.01);
        assertTrue(r.damFromRecords());
        assertEquals(r.avgDailyL() * 1.4, r.peakDailyL(), 0.1); // dam's own peak ratio
    }

    @Test
    void weakBullAndLowDamPullBelowFarmAverage() {
        var r = SireYieldPredictor.predict(in(6.0, 120, 7000.0, 10000.0));
        assertTrue(r.avgDailyL() < 8.0);
        assertEquals(-0.3, r.damEffectL(), 0.01); // ½ × 0.3 × (6 − 8)
    }

    @Test
    void fewDamRecordsFallBackToFarmAverageAndFarmPeakRatio() {
        var r = SireYieldPredictor.predict(in(20.0, 10, 10000.0, 10000.0));
        assertFalse(r.damFromRecords());
        assertEquals(8.0, r.avgDailyL(), 0.01);
        assertEquals(10.4, r.peakDailyL(), 0.01); // farm ratio 1.3
    }

    @Test
    void breedChangeIsCapped() {
        var i = new SireYieldPredictor.Inputs(8.0, null, null, 0, null, null, null, 30000.0, 3000.0, 0.0, 100.0);
        var r = SireYieldPredictor.predict(i);
        assertEquals(8.0 * 0.30, r.breedEffectL(), 0.01);
    }

    @Test
    void zebuBullOnPureHfCowGetsFullHybridVigour() {
        // HF dam (100% exotic) × Gir bull (0%): F1 calf, zebu/taurine heterozygosity 1 → 12%.
        var r = SireYieldPredictor.predict(new SireYieldPredictor.Inputs(10.0, null, null, 0, null,
                null, null, 3864.0, 9466.0, 100.0, 0.0));
        assertEquals(-3.0, r.breedEffectL(), 0.05);   // −29.6%
        assertEquals(12.0, r.heterosisPct(), 0.01);
        assertEquals(0.8, r.heterosisL(), 0.01);      // (10 − 2.96) × 0.12
        assertEquals(7.9, r.avgDailyL(), 0.01);       // 10 − 2.96 + 0.84
    }

    @Test
    void crossbredCowGetsHalfAndSameGroupCrossGetsFloor() {
        // HF-cross dam (50%) × Sahiwal: heterozygosity 0.5 → 6%.
        var cb = SireYieldPredictor.predict(new SireYieldPredictor.Inputs(10.0, null, null, 0, null,
                null, null, 3978.0, 9466.0, 50.0, 0.0));
        assertEquals(6.0, cb.heterosisPct(), 0.01);
        // HF × Jersey: both taurine → 5% floor.
        var hj = SireYieldPredictor.predict(new SireYieldPredictor.Inputs(10.0, null, null, 0, null,
                null, null, 6193.0, 9466.0, 100.0, 100.0));
        assertEquals(5.0, hj.heterosisPct(), 0.01);
        // Same breed family: no breed effect, no heterosis.
        var same = SireYieldPredictor.predict(in(8.0, 120, 10000.0, 10000.0));
        assertEquals(0.0, same.heterosisL(), 0.001);
    }

    @Test
    void catalogueCategoryKeepsBuffaloBullsAwayFromCows() {
        assertEquals("CATTLE", SireAnalysisService.catalogueCategory("COW"));
        assertEquals("BUFFALO", SireAnalysisService.catalogueCategory("buffalo"));
        assertNull(SireAnalysisService.catalogueCategory("GOAT"));
    }

    @Test
    void bestCaseUsesTargetCapacityWithSameGenetics() {
        // Yashoda x Kevin: today 8.5 L farm / 7.8 L dam; at target 16.5 L farm / 18.9 L dam.
        var today = SireYieldPredictor.predict(new SireYieldPredictor.Inputs(8.5, 7.8, 10.1, 186, 1.3,
                14704.0, 10277.0, null, null, 65.0, 100.0));
        var best = SireYieldPredictor.predict(new SireYieldPredictor.Inputs(16.5, 18.9, 18.9 * 10.1 / 7.8,
                SireYieldPredictor.MIN_DAM_DAYS, 1.3, 14704.0, 10277.0, null, null, 65.0, 100.0));
        assertEquals(8.9, today.avgDailyL(), 0.05);
        assertEquals(17.9, best.avgDailyL(), 0.1);
        assertTrue(best.sireEffectL() > today.sireEffectL(), "good genetics show more on a better-fed farm");
        var notes = SireYieldPredictor.insights(new SireYieldPredictor.Inputs(8.5, 7.8, 10.1, 186, 1.3,
                14704.0, 10277.0, null, null, 65.0, 100.0), today,
                new SireYieldPredictor.Inputs(16.5, 18.9, null, 30, 1.3, 14704.0, 10277.0, null, null, 65.0, 100.0),
                best, "Kevin", "Premium", "Yashoda", 15843.0, "DE 14 058 46011");
        assertTrue(notes.contains("Feeding the herd to BCS 3–3.5 adds 9.0 L/day to the daughter"), notes.toString());
        assertTrue(notes.stream().anyMatch(n -> n.contains("elite-farm record (Germany)")));
        assertTrue(notes.stream().noneMatch(n -> n.contains("43%") || n.contains("15,843")), "insights must not repeat card figures");
    }

    @Test
    void premiumBullBeatsOneStarMoreOnAWellFedFarm() {
        var today = new SireYieldPredictor.Inputs(9.5, 7.8, 10.1, 186, 1.3, 14704.0, 10277.0, null, null, 65.0, 100.0);
        var best = new SireYieldPredictor.Inputs(16.2, 18.9, null, 30, 1.3, 14704.0, 10277.0, null, null, 65.0, 100.0);
        double gapToday = SireYieldPredictor.predict(today).avgDailyL()
                - SireYieldPredictor.predict(SireYieldPredictor.withPedigree(today, 6120.0)).avgDailyL();
        double gapBest = SireYieldPredictor.predict(best).avgDailyL()
                - SireYieldPredictor.predict(SireYieldPredictor.withPedigree(best, 6120.0)).avgDailyL();
        assertEquals(1.2, gapToday, 0.11);
        assertEquals(2.0, gapBest, 0.11);
        assertTrue(gapBest > gapToday);
    }

    @Test
    void exoticPctAndFamily() {
        assertEquals(65.0, SireYieldPredictor.exoticPct("Holstein 65%"));
        assertEquals(50.0, SireYieldPredictor.exoticPct("Jersey Cross"));
        assertEquals(100.0, SireYieldPredictor.exoticPct("HF"));
        assertEquals(50.0, SireYieldPredictor.exoticPct("HFxSahiwal"));
        assertEquals(0.0, SireYieldPredictor.exoticPct("Gir"));
        assertNull(SireYieldPredictor.exoticPct("Unknown"));
        assertEquals("HF", SireYieldPredictor.family("Holstein Friesian"));
        assertEquals("JERSEY", SireYieldPredictor.family("JYCB"));
        assertEquals("MURRAH", SireYieldPredictor.family("Murrah"));
    }

    @Test
    void pedigreePrefersSireDaughters() {
        assertEquals(14399.5, SireYieldPredictor.pedigreeKg(14243.0, 14556.0, null), 0.01);
        assertEquals(13000.0, SireYieldPredictor.pedigreeKg(14000.0, 14556.0, 12000.0), 0.01);
        assertEquals(5000.0, SireYieldPredictor.pedigreeKg(5000.0, null, null), 0.01);
    }

    @Test
    void resolvesBullFromAiDetails() {
        SireBull tayson = bull("HF-40421", "TAYSON"), tom = bull("HF-40424", "TOM");
        List<SireBull> all = List.of(tayson, tom);
        assertEquals("HF-40421", SireAnalysisService.bullRefOf("Bull ID: HF-40421. TAYSON"));
        assertSame(tayson, SireAnalysisService.resolve("HF-40421", null, all).orElseThrow());
        assertSame(tayson, SireAnalysisService.resolve("hf40421", null, all).orElseThrow());
        assertSame(tayson, SireAnalysisService.resolve("40421", null, all).orElseThrow());
        assertSame(tayson, SireAnalysisService.resolve(null, "AI done with tayson semen", all).orElseThrow());
        assertSame(tom, SireAnalysisService.resolve(SireAnalysisService.bullRefOf("used HF 40424 straw"), null, all).orElseThrow());
        assertTrue(SireAnalysisService.resolve("GIR-601", null, all).isEmpty());
    }

    @Test
    void seedFileHasEveryBullWithTaysonPedigree() throws Exception {
        List<SireBull> rows = SireCatalogSeederAccess.parse();
        assertTrue(rows.size() >= 400, "expected the full Alamadhi directory, got " + rows.size());
        SireBull t = rows.stream().filter(s -> s.getBullNo().equals("HF-40421")).findFirst().orElseThrow();
        assertEquals("TAYSON", t.getBullName());
        assertEquals(14243.0, t.getDamBestYieldKg());
        assertEquals(14556.0, t.getSireDamBestYieldKg());
        assertEquals("Timberlake", t.getSireName());
        assertNotNull(t.getImageUrl());
        assertEquals(rows.size(), rows.stream().map(SireBull::getBullNo).distinct().count(), "bull numbers must be unique");
    }

    private static SireBull bull(String no, String name) {
        SireBull s = new SireBull();
        s.setBullNo(no);
        s.setBullName(name);
        return s;
    }
}
