package com.dairy.service.optimizer;

import com.dairy.dto.optimizer.FeedLineDTO;
import com.dairy.dto.optimizer.NutrientStatusDTO;
import com.dairy.dto.optimizer.PlanAdequacyDTO;
import com.dairy.dto.optimizer.PlanAssignmentDTO;
import com.dairy.dto.optimizer.PlanDetailDTO;
import com.dairy.dto.optimizer.RequirementProfileDTO;
import com.dairy.model.Herd;
import com.dairy.service.HerdService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Checks one saved plan's ration against each of several animals.
 *
 * The point of the feature: a plan stores absolute kilograms, but what an animal NEEDS is
 * resolved from its own breed, weight, yield and stage. Applying one ration to a mixed
 * group is therefore only sound if it actually suits each of them, and this is what says
 * whether it does.
 *
 * Read-only; writes nothing.
 */
@Service
public class PlanAdequacyService {

    @Autowired
    private CustomPlanService customPlanService;

    @Autowired
    private HerdService herdService;

    @Autowired
    private AnimalRequirementResolutionService requirementResolutionService;

    @Autowired
    private NutrientCalculationService nutrientCalculationService;

    public List<PlanAdequacyDTO> evaluate(Long planId, Collection<Long> requestedAnimalIds) {
        PlanDetailDTO plan = customPlanService.loadPlan(planId);

        List<Long> animalIds = resolveTargets(plan, requestedAnimalIds);
        if (animalIds.isEmpty()) return new ArrayList<>();

        List<FeedLineDTO> feeds = plan.getFeeds() != null ? plan.getFeeds() : List.of();

        // Nutrient totals depend only on the ration, so they are computed once and reused;
        // only the requirement they are compared against varies per animal.
        Map<String, Double> totals = nutrientCalculationService.calculateTotals(feeds);

        List<PlanAdequacyDTO> results = new ArrayList<>();
        for (Herd herd : herdService.getHerdsByIds(animalIds)) {
            RequirementProfileDTO profile = requirementResolutionService.resolve(herd, null);
            Map<String, NutrientStatusDTO> nutrientStatus =
                    nutrientCalculationService.evaluate(totals, profile.getTargets());

            PlanAdequacyDTO dto = new PlanAdequacyDTO();
            dto.setAnimalId(herd.getId());
            dto.setAnimalName(herd.getAnimalName());
            dto.setTagNumber(herd.getTagNumber());
            dto.setResolvedStage(profile.getResolvedStage());
            dto.setNutrientStatus(nutrientStatus);
            dto.setOverallStatus(overallStatus(nutrientStatus));
            results.add(dto);
        }
        return results;
    }

    /** Explicit ids when given, otherwise whoever the plan is currently assigned to. */
    private List<Long> resolveTargets(PlanDetailDTO plan, Collection<Long> requestedAnimalIds) {
        Set<Long> ids = new LinkedHashSet<>();
        if (requestedAnimalIds != null && !requestedAnimalIds.isEmpty()) {
            requestedAnimalIds.stream().filter(java.util.Objects::nonNull).forEach(ids::add);
        } else if (plan.getAssignments() != null) {
            plan.getAssignments().stream()
                    .map(PlanAssignmentDTO::getAnimalId)
                    .filter(java.util.Objects::nonNull)
                    .forEach(ids::add);
        }
        return new ArrayList<>(ids);
    }

    /** Worst nutrient wins: a single shortfall makes the whole ration DEFICIENT for that animal. */
    private String overallStatus(Map<String, NutrientStatusDTO> nutrientStatus) {
        List<String> statuses = nutrientStatus.values().stream()
                .map(NutrientStatusDTO::getStatus)
                .collect(Collectors.toList());
        if (statuses.contains("DEFICIENT")) return "DEFICIENT";
        if (statuses.contains("EXCESS")) return "EXCESS";
        return "ADEQUATE";
    }
}
