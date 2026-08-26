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
        List<FeedMaster> feeds = feedMasterRepository.findAll();
        List<FeedNutrition> nutritions = feedNutritionRepository.findAll();
        List<FeedKnowledge> knowledges = feedKnowledgeRepository.findAll();
        
        java.util.Map<Long, FeedNutrition> nutMap = nutritions.stream().collect(Collectors.toMap(n -> n.getFeedMaster().getId(), n -> n));
        java.util.Map<Long, FeedKnowledge> knwMap = knowledges.stream().collect(Collectors.toMap(k -> k.getFeedMaster().getId(), k -> k));

        return feeds.stream()
            .map(f -> new FeedResponseDTO(f, nutMap.get(f.getId()), knwMap.get(f.getId())))
            .collect(Collectors.toList());
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
