package com.dairy.service;

import com.dairy.dto.FeedOptimizerRequestDTO;
import com.dairy.dto.FeedOptimizerResponseDTO;
import com.dairy.dto.optimizer.FeedLineDTO;
import com.dairy.model.AnimalRequirement;
import com.dairy.repository.AnimalRequirementRepository;
import com.dairy.service.optimizer.CurrentRationOptimizationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
public class FeedOptimizerService {

    @Autowired
    private AnimalRequirementRepository animalRequirementRepository;

    @Autowired
    private CurrentRationOptimizationService currentRationOptimizationService;

    public List<AnimalRequirement> getAllRequirements() {
        return animalRequirementRepository.findAll();
    }

    public Optional<AnimalRequirement> getRequirementByStage(String stage) {
        return animalRequirementRepository.findByAnimalStage(stage);
    }

    /**
     * Delegates to the real constraint-based optimizer (service.optimizer package).
     * animalId now drives requirement resolution (real breed/DIM/weight/pregnancy);
     * animalStage is kept only as an optional legacy override - see
     * AnimalRequirementResolutionService and docs/feed-optimizer-backend.md.
     */
    public FeedOptimizerResponseDTO optimizeRation(FeedOptimizerRequestDTO request) {
        if (request.getAnimalId() == null) {
            throw new IllegalArgumentException("animalId is required");
        }

        List<FeedLineDTO> feedLines = new ArrayList<>();
        if (request.getFeedEntries() != null) {
            for (FeedOptimizerRequestDTO.FeedEntry entry : request.getFeedEntries()) {
                if (entry.getFeedId() == null || entry.getQuantityKg() == null || entry.getQuantityKg() <= 0) continue;
                feedLines.add(new FeedLineDTO(entry.getFeedId(), null, entry.getQuantityKg()));
            }
        }

        return currentRationOptimizationService.optimize(request.getAnimalId(), request.getAnimalStage(), feedLines);
    }
}
