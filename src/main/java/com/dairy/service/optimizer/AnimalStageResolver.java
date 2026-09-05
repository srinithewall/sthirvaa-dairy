package com.dairy.service.optimizer;

import com.dairy.model.Herd;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

/**
 * Maps a Herd record onto one of the 10 AnimalRequirement.animalStage keys
 * seeded by FeedDataSeeder ("3 Month Calf" .. "Late Lactation"). Herd.animalStatus
 * only has 5 coarse values (CALF/HEIFER/PREGNANT/LACTATING/DRY) with no stored
 * DIM or age-in-days, so this derives DIM (Herd.dim, set by HerdService.enrichHerd
 * from HerdEvent history) and age (Herd.birthDate) and applies the breakpoints in
 * StageMappingProperties - all explicitly flagged there as provisional.
 *
 * KNOWN LIMITATION: the seeded stage set has no "pregnant + lactating" combination
 * (a real dairy cow can be both). Until AnimalRequirement's own data model grows a
 * pregnancy modifier, a PREGNANT animal always resolves to "Pregnant Heifer" here,
 * even if she is also currently lactating.
 */
@Component
public class AnimalStageResolver {

    @Autowired
    private StageMappingProperties stageMapping;

    public String resolveStage(Herd herd) {
        String status = herd.getAnimalStatus() == null ? "" : herd.getAnimalStatus().toUpperCase();

        switch (status) {
            case "PREGNANT":
                return "Pregnant Heifer";
            case "DRY":
                return "Dry Cow";
            case "LACTATING":
                return resolveLactationStage(herd.getDim());
            case "CALF":
            case "HEIFER":
                return resolveYoungStockStage(herd.getBirthDate());
            default:
                // Unknown/unset status - fall back to age-based young-stock staging
                // as the least-wrong default rather than guessing a lactation stage.
                return resolveYoungStockStage(herd.getBirthDate());
        }
    }

    private String resolveLactationStage(Integer dim) {
        if (dim == null) {
            // No LACTATION_STARTED event on record - can't tell how far into
            // lactation she is. Early Lactation is the safe, common default.
            return "Early Lactation";
        }
        if (dim <= stageMapping.getFreshCowMaxDim()) return "Fresh Cow";
        if (dim <= stageMapping.getEarlyLactationMaxDim()) return "Early Lactation";
        if (dim <= stageMapping.getPeakLactationMaxDim()) return "Peak Lactation";
        if (dim <= stageMapping.getMidLactationMaxDim()) return "Mid Lactation";
        return "Late Lactation";
    }

    private String resolveYoungStockStage(LocalDate birthDate) {
        if (birthDate == null) return "1 Year Heifer";
        long ageDays = ChronoUnit.DAYS.between(birthDate, LocalDate.now());
        if (ageDays <= stageMapping.getCalf3MonthMaxAgeDays()) return "3 Month Calf";
        if (ageDays <= stageMapping.getCalf6MonthMaxAgeDays()) return "6 Month Calf";
        return "1 Year Heifer";
    }
}
