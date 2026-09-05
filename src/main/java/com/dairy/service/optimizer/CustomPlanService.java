package com.dairy.service.optimizer;

import com.dairy.dto.optimizer.FeedLineDTO;
import com.dairy.dto.optimizer.PlanDetailDTO;
import com.dairy.dto.optimizer.PlanSummaryDTO;
import com.dairy.dto.optimizer.SavePlanRequestDTO;
import com.dairy.dto.optimizer.UpdatePlanRequestDTO;
import com.dairy.exception.AnimalNotFoundException;
import com.dairy.exception.FeedNotFoundException;
import com.dairy.exception.PlanNotFoundException;
import com.dairy.model.FeedMaster;
import com.dairy.model.FeedPlan;
import com.dairy.model.FeedPlanItem;
import com.dairy.repo.HerdRepository;
import com.dairy.repository.FeedMasterRepository;
import com.dairy.repository.FeedPlanItemRepository;
import com.dairy.repository.FeedPlanRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

/** Custom Plan persistence: Animal -> FeedPlan -> FeedPlanItem -> FeedMaster, always animal-scoped. */
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

    @Transactional
    public PlanSummaryDTO savePlan(SavePlanRequestDTO request) {
        if (!herdRepository.existsById(request.getAnimalId())) {
            throw new AnimalNotFoundException(request.getAnimalId());
        }

        FeedPlan plan = new FeedPlan();
        plan.setHerdId(request.getAnimalId());
        plan.setPlanName(request.getPlanName());
        plan.setPlanType("CUSTOM");
        FeedPlan saved = feedPlanRepository.save(plan);

        List<FeedLine> lines = request.getFeedEntries().stream()
                .map(e -> new FeedLine(e.getFeedId(), e.getQuantityKg()))
                .collect(Collectors.toList());
        Double cost = writeItems(saved.getId(), lines);

        if (cost != null) {
            saved.setTotalEstimatedCost(cost);
            saved = feedPlanRepository.save(saved);
        }

        return toSummary(saved);
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

        return toSummary(feedPlanRepository.save(plan));
    }

    @Transactional
    public void deletePlan(Long planId) {
        if (!feedPlanRepository.existsById(planId)) {
            throw new PlanNotFoundException(planId);
        }
        feedPlanItemRepository.deleteByFeedPlanId(planId);
        feedPlanRepository.deleteById(planId);
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
        return feedPlanRepository.findByHerdIdOrderByUpdatedAtDesc(animalId).stream()
                .map(this::toSummary)
                .collect(Collectors.toList());
    }

    public PlanDetailDTO loadPlan(Long planId) {
        FeedPlan plan = feedPlanRepository.findById(planId)
                .orElseThrow(() -> new PlanNotFoundException(planId));

        List<FeedPlanItem> items = feedPlanItemRepository.findByFeedPlanId(planId);
        List<FeedLineDTO> feeds = new ArrayList<>();
        for (FeedPlanItem item : items) {
            String feedName = feedMasterRepository.findById(item.getFeedId())
                    .map(FeedMaster::getFeedName)
                    .orElse(null);
            feeds.add(new FeedLineDTO(item.getFeedId(), feedName, item.getQuantityKg()));
        }

        PlanDetailDTO dto = new PlanDetailDTO();
        dto.setId(plan.getId());
        dto.setAnimalId(plan.getHerdId());
        dto.setPlanName(plan.getPlanName());
        dto.setPlanType(plan.getPlanType());
        dto.setFeeds(feeds);
        dto.setTotalEstimatedCost(plan.getTotalEstimatedCost());
        return dto;
    }

    private PlanSummaryDTO toSummary(FeedPlan plan) {
        return new PlanSummaryDTO(plan.getId(), plan.getPlanName(), plan.getPlanType(), plan.getTotalEstimatedCost(), plan.getUpdatedAt());
    }
}
