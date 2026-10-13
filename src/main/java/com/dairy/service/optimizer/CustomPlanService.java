package com.dairy.service.optimizer;

import com.dairy.dto.optimizer.AssignPlanRequestDTO;
import com.dairy.dto.optimizer.FeedLineDTO;
import com.dairy.dto.optimizer.PlanAssignmentDTO;
import com.dairy.dto.optimizer.PlanDetailDTO;
import com.dairy.dto.optimizer.PlanSummaryDTO;
import com.dairy.dto.optimizer.SavePlanRequestDTO;
import com.dairy.dto.optimizer.UpdatePlanRequestDTO;
import com.dairy.exception.AnimalNotFoundException;
import com.dairy.exception.FeedNotFoundException;
import com.dairy.exception.PlanNotFoundException;
import com.dairy.model.FeedMaster;
import com.dairy.model.FeedPlan;
import com.dairy.model.FeedPlanAssignment;
import com.dairy.model.FeedPlanItem;
import com.dairy.model.Herd;
import com.dairy.repo.HerdRepository;
import com.dairy.repository.FeedMasterRepository;
import com.dairy.repository.FeedPlanAssignmentRepository;
import com.dairy.repository.FeedPlanItemRepository;
import com.dairy.repository.FeedPlanRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Custom Plan persistence.
 *
 * A plan is a recipe (FeedPlan -> FeedPlanItem -> FeedMaster) and FeedPlanAssignment says
 * which animals it applies to, so one plan can serve a group and editing it updates every
 * assigned animal at once. See docs/feed-plans-v2-spec.md.
 */
@Service
public class CustomPlanService {

    @Autowired
    private FeedPlanRepository feedPlanRepository;

    @Autowired
    private FeedPlanItemRepository feedPlanItemRepository;

    @Autowired
    private FeedMasterRepository feedMasterRepository;

    @Autowired
    private HerdRepository herdRepository;

    @Autowired
    private FeedPlanAssignmentRepository assignmentRepository;

    @Transactional
    public PlanSummaryDTO savePlan(SavePlanRequestDTO request) {
        List<Long> animalIds = resolveAnimalIds(request);
        requireAnimalsExist(animalIds);

        FeedPlan plan = new FeedPlan();
        plan.setPlanName(request.getPlanName());
        plan.setPlanType("CUSTOM");
        // Deprecated column, still written so the app keeps working before the Phase 2
        // migration relaxes it to NULL. See FeedPlan.herdId.
        plan.setHerdId(animalIds.isEmpty() ? null : animalIds.get(0));
        FeedPlan saved = feedPlanRepository.save(plan);

        List<FeedLine> lines = request.getFeedEntries().stream()
                .map(e -> new FeedLine(e.getFeedId(), e.getQuantityKg()))
                .collect(Collectors.toList());
        Double cost = writeItems(saved.getId(), lines);

        if (cost != null) {
            saved.setTotalEstimatedCost(cost);
            saved = feedPlanRepository.save(saved);
        }

        writeAssignments(saved.getId(), animalIds);
        return toSummary(saved, animalIds.size());
    }

    /** Union of the legacy animalId and the animalIds list, de-duplicated, order preserved. */
    private List<Long> resolveAnimalIds(SavePlanRequestDTO request) {
        Set<Long> ids = new LinkedHashSet<>();
        if (request.getAnimalId() != null) ids.add(request.getAnimalId());
        if (request.getAnimalIds() != null) {
            request.getAnimalIds().stream().filter(java.util.Objects::nonNull).forEach(ids::add);
        }
        return new ArrayList<>(ids);
    }

    private void requireAnimalsExist(List<Long> animalIds) {
        for (Long animalId : animalIds) {
            if (!herdRepository.existsById(animalId)) throw new AnimalNotFoundException(animalId);
        }
    }

    private void writeAssignments(Long planId, List<Long> animalIds) {
        if (animalIds.isEmpty()) return;
        assignmentRepository.saveAll(animalIds.stream()
                .map(animalId -> new FeedPlanAssignment(planId, animalId))
                .collect(Collectors.toList()));
    }

    /**
     * Replaces a plan's name and feed lines. The request carries the complete ration, so
     * existing lines are deleted rather than merged.
     */
    @Transactional
    public PlanSummaryDTO updatePlan(Long planId, UpdatePlanRequestDTO request) {
        FeedPlan plan = feedPlanRepository.findById(planId)
                .orElseThrow(() -> new PlanNotFoundException(planId));

        plan.setPlanName(request.getPlanName());

        feedPlanItemRepository.deleteByFeedPlanId(planId);
        // Hibernate flushes inserts before deletes within a transaction, which would leave
        // the old rows behind. Force the delete out first.
        feedPlanItemRepository.flush();

        List<FeedLine> lines = request.getFeedEntries().stream()
                .map(e -> new FeedLine(e.getFeedId(), e.getQuantityKg()))
                .collect(Collectors.toList());
        // Set unconditionally, including null: a ration edited down to feeds with no price
        // must clear its previous cost rather than keep a stale figure.
        plan.setTotalEstimatedCost(writeItems(planId, lines));

        int assignmentCount = assignmentRepository.findByFeedPlanId(planId).size();
        return toSummary(feedPlanRepository.save(plan), assignmentCount);
    }

    @Transactional
    public void deletePlan(Long planId) {
        if (!feedPlanRepository.existsById(planId)) {
            throw new PlanNotFoundException(planId);
        }
        feedPlanItemRepository.deleteByFeedPlanId(planId);
        assignmentRepository.deleteByFeedPlanId(planId);
        feedPlanRepository.deleteById(planId);
    }

    /**
     * Replaces the set of animals a plan applies to. An empty list unassigns everything and
     * leaves the plan as a template rather than deleting it.
     */
    @Transactional
    public PlanDetailDTO replaceAssignments(Long planId, AssignPlanRequestDTO request) {
        FeedPlan plan = feedPlanRepository.findById(planId)
                .orElseThrow(() -> new PlanNotFoundException(planId));

        Set<Long> unique = new LinkedHashSet<>();
        if (request.getAnimalIds() != null) {
            request.getAnimalIds().stream().filter(java.util.Objects::nonNull).forEach(unique::add);
        }
        List<Long> animalIds = new ArrayList<>(unique);
        requireAnimalsExist(animalIds);

        assignmentRepository.deleteByFeedPlanId(planId);
        // Same flush-before-insert ordering as updatePlan: without it Hibernate would write
        // the new rows first and trip the (feed_plan_id, herd_id) unique constraint.
        assignmentRepository.flush();
        writeAssignments(planId, animalIds);

        // Keep the deprecated column pointing at a still-assigned animal.
        plan.setHerdId(animalIds.isEmpty() ? null : animalIds.get(0));
        feedPlanRepository.save(plan);

        return loadPlan(planId);
    }

    /** A feed line independent of which request DTO it arrived on. */
    private record FeedLine(Long feedId, Double quantityKg) {}

    /**
     * Persists the item rows for a plan and returns the total estimated cost,
     * or null when no feed in the ration carries a price.
     */
    private Double writeItems(Long planId, List<FeedLine> lines) {
        List<FeedPlanItem> items = new ArrayList<>();
        double totalCost = 0;
        boolean anyCost = false;
        for (FeedLine line : lines) {
            FeedMaster feed = feedMasterRepository.findById(line.feedId())
                    .orElseThrow(() -> new FeedNotFoundException(line.feedId()));
            items.add(new FeedPlanItem(planId, feed.getId(), line.quantityKg()));
            if (feed.getCostPerKgAsFed() != null) {
                totalCost += feed.getCostPerKgAsFed() * line.quantityKg();
                anyCost = true;
            }
        }
        feedPlanItemRepository.saveAll(items);
        return anyCost ? Math.round(totalCost * 100.0) / 100.0 : null;
    }

    public List<PlanSummaryDTO> listPlans(Long animalId) {
        if (!herdRepository.existsById(animalId)) {
            throw new AnimalNotFoundException(animalId);
        }
        List<Long> planIds = assignmentRepository.findByHerdId(animalId).stream()
                .map(FeedPlanAssignment::getFeedPlanId)
                .distinct()
                .collect(Collectors.toList());
        if (planIds.isEmpty()) return List.of();

        return summarize(feedPlanRepository.findAllById(planIds));
    }

    /** Every plan, for a manage-plans view that is not scoped to one animal. */
    public List<PlanSummaryDTO> listAllPlans() {
        return summarize(feedPlanRepository.findAll());
    }

    /** Sorts newest-updated first and attaches assignment counts in a single extra query. */
    private List<PlanSummaryDTO> summarize(List<FeedPlan> plans) {
        if (plans.isEmpty()) return List.of();

        Map<Long, Integer> counts = countAssignments(plans.stream()
                .map(FeedPlan::getId)
                .collect(Collectors.toList()));

        return plans.stream()
                .sorted(Comparator.comparing(FeedPlan::getUpdatedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .map(plan -> toSummary(plan, counts.getOrDefault(plan.getId(), 0)))
                .collect(Collectors.toList());
    }

    private Map<Long, Integer> countAssignments(List<Long> planIds) {
        Map<Long, Integer> counts = new HashMap<>();
        for (FeedPlanAssignment assignment : assignmentRepository.findByFeedPlanIdIn(planIds)) {
            counts.merge(assignment.getFeedPlanId(), 1, Integer::sum);
        }
        return counts;
    }

    public PlanDetailDTO loadPlan(Long planId) {
        FeedPlan plan = feedPlanRepository.findById(planId)
                .orElseThrow(() -> new PlanNotFoundException(planId));

        List<FeedPlanItem> items = feedPlanItemRepository.findByFeedPlanId(planId);
        // Feed names in one query rather than one per line.
        Map<Long, String> feedNames = new HashMap<>();
        if (!items.isEmpty()) {
            List<Long> feedIds = items.stream().map(FeedPlanItem::getFeedId).distinct().collect(Collectors.toList());
            for (FeedMaster feed : feedMasterRepository.findAllById(feedIds)) {
                feedNames.put(feed.getId(), feed.getFeedName());
            }
        }
        List<FeedLineDTO> feeds = items.stream()
                .map(item -> new FeedLineDTO(item.getFeedId(), feedNames.get(item.getFeedId()), item.getQuantityKg()))
                .collect(Collectors.toList());

        List<PlanAssignmentDTO> assignments = loadAssignments(planId);

        PlanDetailDTO dto = new PlanDetailDTO();
        dto.setId(plan.getId());
        // Deprecated single-animal field: first assignment, falling back to the old column
        // for plans created before assignments existed and not yet backfilled.
        dto.setAnimalId(assignments.isEmpty() ? plan.getHerdId() : assignments.get(0).getAnimalId());
        dto.setPlanName(plan.getPlanName());
        dto.setPlanType(plan.getPlanType());
        dto.setFeeds(feeds);
        dto.setAssignments(assignments);
        dto.setAssignmentCount(assignments.size());
        dto.setTotalEstimatedCost(plan.getTotalEstimatedCost());
        return dto;
    }

    private List<PlanAssignmentDTO> loadAssignments(Long planId) {
        List<Long> herdIds = assignmentRepository.findByFeedPlanId(planId).stream()
                .map(FeedPlanAssignment::getHerdId)
                .distinct()
                .collect(Collectors.toList());
        if (herdIds.isEmpty()) return new ArrayList<>();

        Map<Long, Herd> herdsById = new HashMap<>();
        for (Herd herd : herdRepository.findAllById(herdIds)) {
            herdsById.put(herd.getId(), herd);
        }
        // Assignment rows can outlive a deleted animal; skip those rather than emitting nulls.
        return herdIds.stream()
                .map(herdsById::get)
                .filter(java.util.Objects::nonNull)
                .map(herd -> new PlanAssignmentDTO(herd.getId(), herd.getAnimalName(), herd.getTagNumber()))
                .collect(Collectors.toList());
    }

    private PlanSummaryDTO toSummary(FeedPlan plan) {
        return toSummary(plan, 0);
    }

    private PlanSummaryDTO toSummary(FeedPlan plan, int assignmentCount) {
        PlanSummaryDTO summary = new PlanSummaryDTO(plan.getId(), plan.getPlanName(), plan.getPlanType(),
                plan.getTotalEstimatedCost(), plan.getUpdatedAt());
        summary.setAssignmentCount(assignmentCount);
        return summary;
    }
}
