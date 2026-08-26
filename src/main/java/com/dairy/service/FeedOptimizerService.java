package com.dairy.service;

import com.dairy.dto.FeedOptimizerRequestDTO;
import com.dairy.dto.FeedOptimizerResponseDTO;
import com.dairy.model.AnimalRequirement;
import com.dairy.model.FeedNutrition;
import com.dairy.repository.AnimalRequirementRepository;
import com.dairy.repository.FeedNutritionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class FeedOptimizerService {

    @Autowired
    private AnimalRequirementRepository animalRequirementRepository;

    @Autowired
    private FeedNutritionRepository feedNutritionRepository;

    public List<AnimalRequirement> getAllRequirements() {
        return animalRequirementRepository.findAll();
    }

    public Optional<AnimalRequirement> getRequirementByStage(String stage) {
        return animalRequirementRepository.findByAnimalStage(stage);
    }

    public FeedOptimizerResponseDTO optimizeRation(FeedOptimizerRequestDTO request) {
        FeedOptimizerResponseDTO response = new FeedOptimizerResponseDTO();
        
        Optional<AnimalRequirement> reqOpt = animalRequirementRepository.findByAnimalStage(request.getAnimalStage());
        if (reqOpt.isEmpty()) {
            throw new IllegalArgumentException("Animal stage not found: " + request.getAnimalStage());
        }
        
        AnimalRequirement req = reqOpt.get();
        response.setRequirements(req);
        
        double totalDM = 0;
        double totalCP = 0;
        double totalTDN = 0;
        double totalME = 0;
        double totalCa = 0;
        double totalP = 0;
        
        for (FeedOptimizerRequestDTO.FeedEntry entry : request.getFeedEntries()) {
            if (entry.getQuantityKg() == null || entry.getQuantityKg() <= 0) continue;
            
            Optional<FeedNutrition> nutOpt = feedNutritionRepository.findByFeedMasterId(entry.getFeedId());
            if (nutOpt.isPresent()) {
                FeedNutrition nut = nutOpt.get();
                double qty = entry.getQuantityKg();
                
                // Assuming percentages are stored as 1-100, we divide by 100 for true percentage
                double dm = (nut.getDryMatterPct() != null ? nut.getDryMatterPct() : 90) / 100.0;
                double dryMatterKg = qty * dm;
                totalDM += dryMatterKg;
                
                if (nut.getCrudeProteinPct() != null) totalCP += dryMatterKg * (nut.getCrudeProteinPct() / 100.0);
                if (nut.getTdnPct() != null) totalTDN += dryMatterKg * (nut.getTdnPct() / 100.0);
                if (nut.getMetabolizableEnergy() != null) totalME += dryMatterKg * nut.getMetabolizableEnergy();
                
                // Assuming minerals are in percentage of DM
                if (nut.getCalciumPct() != null) totalCa += (dryMatterKg * 1000) * (nut.getCalciumPct() / 100.0); // in grams
                if (nut.getPhosphorusPct() != null) totalP += (dryMatterKg * 1000) * (nut.getPhosphorusPct() / 100.0); // in grams
            }
        }
        
        Map<String, Double> totals = new HashMap<>();
        totals.put("DryMatter", totalDM);
        totals.put("CrudeProtein", totalCP);
        totals.put("TDN", totalTDN);
        totals.put("MetabolizableEnergy", totalME);
        totals.put("Calcium", totalCa);
        totals.put("Phosphorus", totalP);
        response.setTotals(totals);
        
        Map<String, String> status = new HashMap<>();
        List<String> recommendations = new ArrayList<>();
        
        evaluateNutrient("DryMatter", totalDM, req.getDryMatterIntake(), status, recommendations, "Add more dry fodder like straw or hay.", "Reduce overall feed quantity.");
        evaluateNutrient("CrudeProtein", totalCP, req.getCrudeProteinReq(), status, recommendations, "Add more protein sources like Soybean Meal, Groundnut Cake, or Lucerne.", "Reduce high protein concentrates.");
        evaluateNutrient("TDN", totalTDN, req.getTdnReq(), status, recommendations, "Add more energy sources like Maize grain, Molasses, or high-quality grasses.", "Reduce energy-dense feeds.");
        evaluateNutrient("Calcium", totalCa, req.getCalciumReq(), status, recommendations, "Add mineral mixture or legumes like Lucerne/Moringa.", "Slightly reduce calcium-rich feeds.");
        
        response.setStatus(status);
        response.setRecommendations(recommendations);
        
        return response;
    }
    
    private void evaluateNutrient(String name, double actual, Double required, Map<String, String> status, List<String> recs, String lowRec, String highRec) {
        if (required == null || required == 0) {
            status.put(name, "OK");
            return;
        }
        
        double ratio = actual / required;
        if (ratio < 0.9) {
            status.put(name, "DEFICIENT");
            recs.add(name + " is Deficient. " + lowRec);
        } else if (ratio > 1.2) {
            status.put(name, "EXCESS");
            recs.add(name + " is in Excess. " + highRec);
        } else {
            status.put(name, "OK");
        }
    }
}
