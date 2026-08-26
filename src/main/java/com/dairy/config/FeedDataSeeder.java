package com.dairy.config;

import com.dairy.model.AnimalRequirement;
import com.dairy.model.FeedKnowledge;
import com.dairy.model.FeedMaster;
import com.dairy.model.FeedNutrition;
import com.dairy.repository.AnimalRequirementRepository;
import com.dairy.repository.FeedMasterRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import com.dairy.service.FeedService;

import java.io.InputStream;
import java.util.List;
import java.util.Map;

@Component
public class FeedDataSeeder implements CommandLineRunner {

    @Autowired
    private FeedMasterRepository feedMasterRepository;

    @Autowired
    private AnimalRequirementRepository animalRequirementRepository;

    @Autowired
    private FeedService feedService;

    @Override
    public void run(String... args) throws Exception {
        seedFeeds();
        seedAnimalRequirements();
    }

    private void seedFeeds() {
        if (feedMasterRepository.count() == 0) {
            try {
                ObjectMapper mapper = new ObjectMapper();
                InputStream is = new ClassPathResource("feed_seed_data.json").getInputStream();
                List<Map<String, Object>> feeds = mapper.readValue(is, new TypeReference<List<Map<String, Object>>>() {});
                
                for (Map<String, Object> feedData : feeds) {
                    FeedMaster feed = new FeedMaster();
                    feed.setFeedName((String) feedData.get("feedName"));
                    feed.setCategory((String) feedData.get("category"));
                    feed.setReferenceSource((String) feedData.get("referenceSource"));
                    if (feedData.get("palatabilityRating") != null) {
                        feed.setPalatabilityRating(Integer.parseInt(feedData.get("palatabilityRating").toString()));
                    }
                    feed.setRemarks((String) feedData.get("remarks"));
                    
                    // Add dummy translations and cost
                    feed.setKannadaName(feed.getFeedName() + " (ಕನ್ನಡ)");
                    feed.setTamilName(feed.getFeedName() + " (தமிழ்)");
                    feed.setCostRating("Medium");
                    
                    FeedMaster savedFeed = feedService.saveFeed(feed);
                    
                    FeedNutrition nutrition = new FeedNutrition();
                    nutrition.setFeedMaster(savedFeed);
                    // Add dummy nutrition based on category for demonstration
                    if ("Grass".equalsIgnoreCase(feed.getCategory())) {
                        nutrition.setCrudeProteinPct(12.0);
                        nutrition.setTdnPct(55.0);
                        nutrition.setCalciumPct(0.5);
                        nutrition.setPrimaryNutrient("Fiber");
                        nutrition.setNutritionRating("High");
                    } else if ("Legume".equalsIgnoreCase(feed.getCategory())) {
                        nutrition.setCrudeProteinPct(20.0);
                        nutrition.setTdnPct(65.0);
                        nutrition.setCalciumPct(1.2);
                        nutrition.setPrimaryNutrient("Protein+Minerals");
                        nutrition.setNutritionRating("Very High");
                    } else {
                        nutrition.setCrudeProteinPct(10.0);
                        nutrition.setTdnPct(60.0);
                        nutrition.setCalciumPct(0.3);
                        nutrition.setPrimaryNutrient("Energy");
                        nutrition.setNutritionRating("Medium");
                    }
                    feedService.saveNutrition(nutrition);
                    
                    FeedKnowledge knowledge = new FeedKnowledge();
                    knowledge.setFeedMaster(savedFeed);
                    knowledge.setDescription("Generated knowledge base for " + feed.getFeedName());
                    feedService.saveKnowledge(knowledge);
                }
                System.out.println("Seeded " + feeds.size() + " feed ingredients from JSON.");
            } catch (Exception e) {
                System.err.println("Failed to seed feed data: " + e.getMessage());
            }
        }
    }

    private void seedAnimalRequirements() {
        if (animalRequirementRepository.count() == 0) {
            String[] stages = {"3 Month Calf", "6 Month Calf", "1 Year Heifer", "Pregnant Heifer", 
                               "Dry Cow", "Fresh Cow", "Early Lactation", "Peak Lactation", 
                               "Mid Lactation", "Late Lactation"};
            
            for (String stage : stages) {
                AnimalRequirement req = new AnimalRequirement();
                req.setAnimalStage(stage);
                req.setDryMatterIntake(15.0); // Dummy values
                req.setCrudeProteinReq(2.5);
                req.setTdnReq(10.0);
                req.setCalciumReq(50.0);
                animalRequirementRepository.save(req);
            }
            System.out.println("Seeded animal requirements.");
        }
    }
}
