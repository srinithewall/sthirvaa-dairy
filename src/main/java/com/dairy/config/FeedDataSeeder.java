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
import org.springframework.jdbc.core.JdbcTemplate;
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

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Override
    public void run(String... args) throws Exception {
        seedFeeds();
        dropAnimalStageUniqueConstraint();
        seedAnimalRequirements();
    }

    /** Drop the legacy unique index on animal_stage so we can have breed-specific rows per stage. */
    private void dropAnimalStageUniqueConstraint() {
        try {
            // Find and drop all unique indexes on animal_stage (Hibernate-generated name varies)
            List<Map<String, Object>> indexes = jdbcTemplate.queryForList(
                "SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS " +
                "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'animal_requirements' " +
                "AND COLUMN_NAME = 'animal_stage' AND NON_UNIQUE = 0 AND INDEX_NAME != 'PRIMARY'");
            for (Map<String, Object> idx : indexes) {
                String indexName = (String) idx.get("INDEX_NAME");
                jdbcTemplate.execute("ALTER TABLE animal_requirements DROP INDEX " + indexName);
                System.out.println("Dropped unique index: " + indexName);
            }
        } catch (Exception e) {
            System.out.println("No unique index to drop on animal_stage (safe to ignore): " + e.getMessage());
        }
    }

    private void seedFeeds() {
        if (feedMasterRepository.count() == 0) {
            try {
                ObjectMapper mapper = new ObjectMapper();
                InputStream is = new ClassPathResource("feed_seed_data.json").getInputStream();
                List<Map<String, Object>> feeds = mapper.readValue(is, new TypeReference<List<Map<String, Object>>>() {});
                
                // Add missing essential feeds if not present
                boolean hasMaizePowder = feeds.stream().anyMatch(f -> "Maize Powder".equals(f.get("feedName")));
                if (!hasMaizePowder) {
                    feeds.add(Map.of("feedName", "Maize Powder", "category", "Concentrate", "costRating", "Medium", "palatabilityRating", 5));
                }
                
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
                    
                    if (feedData.get("minDailyQtyKg") != null) {
                        feed.setMinDailyQtyKg(Double.parseDouble(feedData.get("minDailyQtyKg").toString()));
                    }
                    if (feedData.get("maxDailyQtyKg") != null) {
                        feed.setMaxDailyQtyKg(Double.parseDouble(feedData.get("maxDailyQtyKg").toString()));
                    }
                    
                    // Force minimum inclusions for our balanced ration
                    String fn = feed.getFeedName();
                    if ("Wheat Straw".equalsIgnoreCase(fn) || "Paddy Straw".equalsIgnoreCase(fn)) {
                        feed.setMinDailyQtyKg(1.5); // Minimum 1.5kg dry fodder
                    } else if ("Mineral Mixture".equalsIgnoreCase(fn)) {
                        feed.setMinDailyQtyKg(0.1); // Minimum 100g
                    } else if ("Salt".equalsIgnoreCase(fn)) {
                        feed.setMinDailyQtyKg(0.03); // Minimum 30g
                    } else if ("Maize Powder".equalsIgnoreCase(fn) || "Wheat Bran".equalsIgnoreCase(fn) || "Soybean Meal".equalsIgnoreCase(fn)) {
                        feed.setMinDailyQtyKg(0.5); // Minimum 500g of concentrates
                    }

                    FeedMaster savedFeed = feedService.saveFeed(feed);
                    
                    FeedNutrition nutrition = new FeedNutrition();
                    nutrition.setFeedMaster(savedFeed);
                    
                    // Override with specific verified data for our balanced ration ingredients
                    fn = feed.getFeedName();
                    if ("Hybrid Napier".equalsIgnoreCase(fn)) {
                        nutrition.setDryMatterPct(20.0); nutrition.setCrudeProteinPct(8.0); nutrition.setTdnPct(55.0); nutrition.setCalciumPct(0.40);
                    } else if ("Lucerne".equalsIgnoreCase(fn) || "Cowpea".equalsIgnoreCase(fn)) {
                        nutrition.setDryMatterPct(20.0); nutrition.setCrudeProteinPct(19.0); nutrition.setTdnPct(60.0); nutrition.setCalciumPct(1.40);
                    } else if ("Wheat Straw".equalsIgnoreCase(fn) || "Paddy Straw".equalsIgnoreCase(fn) || "Rice Straw".equalsIgnoreCase(fn)) {
                        nutrition.setDryMatterPct(90.0); nutrition.setCrudeProteinPct(3.5); nutrition.setTdnPct(42.0); nutrition.setCalciumPct(0.30);
                    } else if ("Maize Powder".equalsIgnoreCase(fn) || "Fodder Maize".equalsIgnoreCase(fn)) {
                        // Assuming Fodder Maize is green, but Maize Powder is grain. Let's make a new entry or just catch all maize
                        nutrition.setDryMatterPct(88.0); nutrition.setCrudeProteinPct(9.5); nutrition.setTdnPct(82.0); nutrition.setCalciumPct(0.05);
                    } else if ("Wheat Bran".equalsIgnoreCase(fn)) {
                        nutrition.setDryMatterPct(88.0); nutrition.setCrudeProteinPct(15.0); nutrition.setTdnPct(67.0); nutrition.setCalciumPct(0.12);
                    } else if ("Soybean Meal".equalsIgnoreCase(fn) || "Groundnut Cake".equalsIgnoreCase(fn)) {
                        nutrition.setDryMatterPct(90.0); nutrition.setCrudeProteinPct(46.0); nutrition.setTdnPct(77.0); nutrition.setCalciumPct(0.30);
                    } else if ("Mineral Mixture".equalsIgnoreCase(fn)) {
                        nutrition.setDryMatterPct(97.0); nutrition.setCrudeProteinPct(0.0); nutrition.setTdnPct(0.0); nutrition.setCalciumPct(22.0);
                    } else if ("Salt".equalsIgnoreCase(fn)) {
                        nutrition.setDryMatterPct(100.0); nutrition.setCrudeProteinPct(0.0); nutrition.setTdnPct(0.0); nutrition.setCalciumPct(0.0);
                    } else {
                        // Fallback logic
                        if ("Grass".equalsIgnoreCase(feed.getCategory())) {
                            nutrition.setCrudeProteinPct(8.0); nutrition.setTdnPct(55.0); nutrition.setCalciumPct(0.4); nutrition.setDryMatterPct(20.0);
                            nutrition.setPrimaryNutrient("Fiber"); nutrition.setNutritionRating("High");
                        } else if ("Legume".equalsIgnoreCase(feed.getCategory())) {
                            nutrition.setCrudeProteinPct(18.0); nutrition.setTdnPct(60.0); nutrition.setCalciumPct(1.2); nutrition.setDryMatterPct(20.0);
                            nutrition.setPrimaryNutrient("Protein+Minerals"); nutrition.setNutritionRating("Very High");
                        } else if ("Dry".equalsIgnoreCase(feed.getCategory())) {
                            nutrition.setCrudeProteinPct(4.0); nutrition.setTdnPct(40.0); nutrition.setCalciumPct(0.3); nutrition.setDryMatterPct(90.0);
                            nutrition.setPrimaryNutrient("Fiber"); nutrition.setNutritionRating("Low");
                        } else {
                            nutrition.setCrudeProteinPct(10.0); nutrition.setTdnPct(65.0); nutrition.setCalciumPct(0.5); nutrition.setDryMatterPct(90.0);
                            nutrition.setPrimaryNutrient("Energy"); nutrition.setNutritionRating("Medium");
                        }
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
        animalRequirementRepository.deleteAll();
        if (animalRequirementRepository.count() == 0) {
            String[] stages = {"3 Month Calf", "6 Month Calf", "1 Year Heifer", "Pregnant Heifer", 
                               "Dry Cow", "Fresh Cow", "Early Lactation", "Peak Lactation", 
                               "Mid Lactation", "Late Lactation"};
            
            for (String stage : stages) {
                // Generic requirement
                AnimalRequirement req = new AnimalRequirement();
                req.setAnimalStage(stage);
                req.setDryMatterIntake(12.0); // feasible DM
                req.setCrudeProteinReq(1.8);  // 15% CP
                req.setTdnReq(7.0);           // 58% TDN
                req.setCalciumReq(40.0);
                animalRequirementRepository.save(req);

                // Specific requirement for Holstein Friesian
                AnimalRequirement hfReq = new AnimalRequirement();
                hfReq.setAnimalStage(stage);
                hfReq.setBreed("Holstein Friesian");
                hfReq.setBodyWeightMin(200.0);
                hfReq.setBodyWeightMax(600.0);
                
                // Set requirements according to Claude's targets for underconditioned HF
                if (stage.contains("Lactation") || stage.contains("Cow")) {
                    hfReq.setDryMatterIntake(9.0);   // ~8.3-9.2 kg
                    hfReq.setCrudeProteinReq(1.10);  // ~1.10 kg (1100g)
                    hfReq.setTdnReq(6.0);            // ~5.9-6.3 kg
                    hfReq.setCalciumReq(73.0);       // ~73 g
                } else if (stage.contains("Calf")) {
                    hfReq.setDryMatterIntake(3.0);
                    hfReq.setCrudeProteinReq(0.40);
                    hfReq.setTdnReq(2.0);
                    hfReq.setCalciumReq(20.0);
                } else {
                    // Heifers
                    hfReq.setDryMatterIntake(6.0);
                    hfReq.setCrudeProteinReq(0.70);
                    hfReq.setTdnReq(4.0);
                    hfReq.setCalciumReq(40.0);
                }
                
                animalRequirementRepository.save(hfReq);
            }
            System.out.println("Seeded animal requirements (including breed-specific ones).");
        }
    }
}
