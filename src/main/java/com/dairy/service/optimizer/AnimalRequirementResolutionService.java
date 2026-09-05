package com.dairy.service.optimizer;

import com.dairy.dto.optimizer.RequirementProfileDTO;
import com.dairy.exception.AnimalNotFoundException;
import com.dairy.exception.RequirementNotFoundException;
import com.dairy.model.AnimalRequirement;
import com.dairy.model.Herd;
import com.dairy.repository.AnimalRequirementRepository;
import com.dairy.service.HerdService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Resolves the nutrient targets for a given animal: load the real Herd record,
 * derive its stage (AnimalStageResolver), then match it against the existing
 * AnimalRequirement table. Does not invent or adjust any requirement values -
 * see FeedDataSeeder for the (still placeholder) seeded numbers.
 */
@Service
public class AnimalRequirementResolutionService {

    @Autowired
    private HerdService herdService;

    @Autowired
    private AnimalStageResolver stageResolver;

    @Autowired
    private AnimalRequirementRepository animalRequirementRepository;

    public RequirementProfileDTO resolve(Long animalId, String stageOverride) {
        Herd herd = herdService.getHerdById(animalId)
                .orElseThrow(() -> new AnimalNotFoundException(animalId));
        return resolve(herd, stageOverride);
    }

    public RequirementProfileDTO resolve(Herd herd, String stageOverride) {
        String stage;
        boolean overridden = false;

        if (stageOverride != null && !stageOverride.isBlank()
                && animalRequirementRepository.findByAnimalStage(stageOverride).isPresent()) {
            stage = stageOverride;
            overridden = true;
        } else {
            stage = stageResolver.resolveStage(herd);
        }

        List<AnimalRequirement> matches = animalRequirementRepository.findMatching(
                stage, herd.getBreed(), herd.getCalculatedWeight(), herd.getAvgMilk30Days());

        AnimalRequirement requirement = matches.stream()
                .max(Comparator.comparingInt(this::specificity))
                .orElseGet(() -> animalRequirementRepository.findByAnimalStage(stage)
                        .orElseThrow(() -> new RequirementNotFoundException(
                                "No AnimalRequirement is seeded for resolved stage '" + stage + "'")));

        RequirementProfileDTO profile = new RequirementProfileDTO();
        profile.setResolvedStage(stage);
        profile.setStageOverridden(overridden);
        profile.setRequirement(requirement);
        profile.setTargets(toTargets(requirement));
        return profile;
    }

    /** More non-null qualifying columns = a more specific match. See repository Javadoc for today's limitation. */
    private int specificity(AnimalRequirement r) {
        int score = 0;
        if (r.getBreed() != null) score++;
        if (r.getBodyWeightMin() != null || r.getBodyWeightMax() != null) score++;
        if (r.getMilkYieldMin() != null || r.getMilkYieldMax() != null) score++;
        return score;
    }

    private Map<String, Double> toTargets(AnimalRequirement r) {
        Map<String, Double> targets = new LinkedHashMap<>();
        targets.put("DryMatter", r.getDryMatterIntake());
        targets.put("CrudeProtein", r.getCrudeProteinReq());
        targets.put("TDN", r.getTdnReq());
        targets.put("Calcium", r.getCalciumReq());
        return targets;
    }
}
