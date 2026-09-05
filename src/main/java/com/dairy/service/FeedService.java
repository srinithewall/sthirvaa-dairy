package com.dairy.service;

import com.dairy.dto.FeedResponseDTO;
import com.dairy.model.FeedKnowledge;
import com.dairy.model.FeedMaster;
import com.dairy.model.FeedNutrition;
import com.dairy.repository.FeedKnowledgeRepository;
import com.dairy.repository.FeedMasterRepository;
import com.dairy.repository.FeedNutritionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class FeedService {

    @Autowired
    private FeedMasterRepository feedMasterRepository;

    @Autowired
    private FeedNutritionRepository feedNutritionRepository;

    @Autowired
    private FeedKnowledgeRepository feedKnowledgeRepository;

    public List<FeedMaster> getAllFeeds() {
        return feedMasterRepository.findAll();
    }

    public List<FeedMaster> getFeedsByCategory(String category) {
        return feedMasterRepository.findByCategory(category);
    }

    public List<String> getAllCategories() {
        return feedMasterRepository.findDistinctCategories();
    }

    public List<FeedResponseDTO> getAllFeedDetails() {
        return buildFeedDetails(feedMasterRepository.findAll());
    }

    /**
     * Assembles feed + nutrition + knowledge in three queries total.
     *
     * The join fetches are load-bearing: both FeedNutrition.feedMaster and
     * FeedKnowledge.feedMaster are @OneToOne, which defaults to EAGER, so a plain findAll()
     * on either issues an extra SELECT per row. With ~110 feeds that was several hundred
     * round trips and made this endpoint the slowest on the feeds screen.
     */
    private List<FeedResponseDTO> buildFeedDetails(List<FeedMaster> feeds) {
        java.util.Map<Long, FeedNutrition> nutMap = feedNutritionRepository.findAllWithFeedMaster()
            .stream().collect(Collectors.toMap(n -> n.getFeedMaster().getId(), n -> n));
        java.util.Map<Long, FeedKnowledge> knwMap = feedKnowledgeRepository.findAllWithFeedMaster()
            .stream().collect(Collectors.toMap(k -> k.getFeedMaster().getId(), k -> k));

        return feeds.stream()
            .map(f -> new FeedResponseDTO(f, nutMap.get(f.getId()), knwMap.get(f.getId())))
            .collect(Collectors.toList());
    }

    /** Category-filtered variant, sharing the same three-query assembly. */
    public List<FeedResponseDTO> getFeedDetailsByCategory(String category) {
        return buildFeedDetails(getFeedsByCategory(category));
    }

    public Optional<FeedResponseDTO> getFeedDetails(Long id) {
        Optional<FeedMaster> feedOpt = feedMasterRepository.findById(id);
        if (feedOpt.isEmpty()) {
            return Optional.empty();
        }

        FeedMaster feed = feedOpt.get();
        FeedNutrition nutrition = feedNutritionRepository.findByFeedMasterId(id).orElse(null);
        FeedKnowledge knowledge = feedKnowledgeRepository.findByFeedMasterId(id).orElse(null);

        return Optional.of(new FeedResponseDTO(feed, nutrition, knowledge));
    }

    public FeedMaster saveFeed(FeedMaster feed) {
        return feedMasterRepository.save(feed);
    }

    public FeedNutrition saveNutrition(FeedNutrition nutrition) {
        return feedNutritionRepository.save(nutrition);
    }

    public FeedKnowledge saveKnowledge(FeedKnowledge knowledge) {
        return feedKnowledgeRepository.save(knowledge);
    }
    
    public void deleteFeed(Long id) {
        feedKnowledgeRepository.findByFeedMasterId(id).ifPresent(k -> feedKnowledgeRepository.delete(k));
        feedNutritionRepository.findByFeedMasterId(id).ifPresent(n -> feedNutritionRepository.delete(n));
        feedMasterRepository.deleteById(id);
    }
}
