package com.dairy.service.optimizer;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * DIM/age breakpoints used to map a Herd record onto one of the 10
 * AnimalRequirement.animalStage rows. PLACEHOLDER values pending domain
 * validation - see application.properties (feed-optimizer.stage-mapping.*)
 * for the full explanation. Externalized here so validated values can be
 * dropped in without touching AnimalStageResolver.
 */
@Component
@ConfigurationProperties(prefix = "feed-optimizer.stage-mapping")
public class StageMappingProperties {
    // Ordered ascending to match FeedDataSeeder's stage array (Fresh -> Early -> Peak -> Mid -> Late).
    private int freshCowMaxDim = 15;
    private int earlyLactationMaxDim = 100;
    private int peakLactationMaxDim = 150;
    private int midLactationMaxDim = 200;
    private int calf3MonthMaxAgeDays = 120;
    private int calf6MonthMaxAgeDays = 210;
    private int heifer1YearMaxAgeDays = 450;

    public int getFreshCowMaxDim() { return freshCowMaxDim; }
    public void setFreshCowMaxDim(int freshCowMaxDim) { this.freshCowMaxDim = freshCowMaxDim; }

    public int getEarlyLactationMaxDim() { return earlyLactationMaxDim; }
    public void setEarlyLactationMaxDim(int earlyLactationMaxDim) { this.earlyLactationMaxDim = earlyLactationMaxDim; }

    public int getPeakLactationMaxDim() { return peakLactationMaxDim; }
    public void setPeakLactationMaxDim(int peakLactationMaxDim) { this.peakLactationMaxDim = peakLactationMaxDim; }

    public int getMidLactationMaxDim() { return midLactationMaxDim; }
    public void setMidLactationMaxDim(int midLactationMaxDim) { this.midLactationMaxDim = midLactationMaxDim; }

    public int getCalf3MonthMaxAgeDays() { return calf3MonthMaxAgeDays; }
    public void setCalf3MonthMaxAgeDays(int calf3MonthMaxAgeDays) { this.calf3MonthMaxAgeDays = calf3MonthMaxAgeDays; }

    public int getCalf6MonthMaxAgeDays() { return calf6MonthMaxAgeDays; }
    public void setCalf6MonthMaxAgeDays(int calf6MonthMaxAgeDays) { this.calf6MonthMaxAgeDays = calf6MonthMaxAgeDays; }

    public int getHeifer1YearMaxAgeDays() { return heifer1YearMaxAgeDays; }
    public void setHeifer1YearMaxAgeDays(int heifer1YearMaxAgeDays) { this.heifer1YearMaxAgeDays = heifer1YearMaxAgeDays; }
}
