package com.dairy.service.optimizer;

import com.dairy.exception.FeedNotFoundException;
import com.dairy.model.FeedMaster;
import com.dairy.model.FeedNutrition;
import com.dairy.repository.FeedMasterRepository;
import com.dairy.repository.FeedNutritionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Loads feeds as solver-ready OptimizationFeed views: active status (FeedMaster.status),
 * nutrient data present, and bounds resolved from FeedMaster.minDailyQtyKg/maxDailyQtyKg
 * falling back to the configurable defaults in ConstraintProperties when unset.
 */
@Service
public class FeedEligibilityService {

    @Autowired
    private FeedMasterRepository feedMasterRepository;

    @Autowired
    private FeedNutritionRepository feedNutritionRepository;

    @Autowired
    private ConstraintProperties constraintProperties;

    /**
     * Active feeds with nutrient data - the candidate pool for a freshly-optimized ration.
     *
     * One query. This used to list every feed and then look its nutrition up individually,
     * which is a query per feed; the status filter stays in Java so null and lower-case
     * statuses are treated exactly as before.
     */
    public List<OptimizationFeed> loadEligibleFeeds() {
        List<OptimizationFeed> result = new ArrayList<>();
        for (FeedNutrition nutrition : feedNutritionRepository.findAllWithFeedMaster()) {
            FeedMaster feed = nutrition.getFeedMaster();
            if (feed == null || !"ACTIVE".equalsIgnoreCase(feed.getStatus())) continue;
            result.add(toOptimizationFeed(feed, nutrition));
        }
        return result;
    }

    /** Loads (and enriches) a specific feed regardless of active status - used so a farmer's
     *  current ration can still be evaluated/adjusted even if that feed was since deactivated. */
    public OptimizationFeed loadFeed(Long feedId) {
        FeedMaster feed = feedMasterRepository.findById(feedId)
                .orElseThrow(() -> new FeedNotFoundException(feedId));
        FeedNutrition nut = feedNutritionRepository.findByFeedMasterId(feedId)
                .orElseThrow(() -> new FeedNotFoundException(feedId));
        return toOptimizationFeed(feed, nut);
    }

    /** Ensures every feed referenced in a baseline ration has a variable in the solver,
     *  even if it wouldn't otherwise be eligible (e.g. deactivated since it was fed). */
    public Map<Long, OptimizationFeed> loadCandidatePool(List<Long> mustIncludeFeedIds) {
        Map<Long, OptimizationFeed> pool = new LinkedHashMap<>();
        for (OptimizationFeed feed : loadEligibleFeeds()) {
            pool.put(feed.getFeedId(), feed);
        }
        for (Long feedId : mustIncludeFeedIds) {
            pool.computeIfAbsent(feedId, this::loadFeed);
        }
        return pool;
    }

    private OptimizationFeed toOptimizationFeed(FeedMaster feed, FeedNutrition nutrition) {
        OptimizationFeed of = new OptimizationFeed();
        of.setFeedId(feed.getId());
        of.setFeedName(feed.getFeedName());
        of.setCategory(feed.getCategory());
        of.setConcentrate(constraintProperties.isConcentrate(feed.getCategory()));
        of.setMinQtyKg(feed.getMinDailyQtyKg() != null ? feed.getMinDailyQtyKg() : constraintProperties.getDefaultMinQtyKg());
        of.setMaxQtyKg(feed.getMaxDailyQtyKg() != null ? feed.getMaxDailyQtyKg() : constraintProperties.getDefaultMaxQtyKg());
        of.setCostPerKgAsFed(feed.getCostPerKgAsFed());
        of.setNutrition(nutrition);
        return of;
    }
}
