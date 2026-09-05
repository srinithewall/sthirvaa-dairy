package com.dairy.controller;

import com.dairy.dto.FeedResponseDTO;
import com.dairy.model.FeedMaster;
import com.dairy.service.FeedService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/feeds")
public class FeedMasterController {

    @Autowired
    private FeedService feedService;

    @GetMapping
    public ResponseEntity<List<FeedResponseDTO>> getAllFeeds(
            @RequestParam(required = false) String category) {
        if (category != null && !category.trim().isEmpty()) {
            // Was two extra queries per feed in the category; now shares the bulk assembly.
            return ResponseEntity.ok(feedService.getFeedDetailsByCategory(category));
        }
        return ResponseEntity.ok(feedService.getAllFeedDetails());
    }

    @GetMapping("/{id}")
    public ResponseEntity<FeedResponseDTO> getFeedDetails(@PathVariable Long id) {
        Optional<FeedResponseDTO> feed = feedService.getFeedDetails(id);
        return feed.map(ResponseEntity::ok)
                   .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/categories")
    public ResponseEntity<List<String>> getCategories() {
        return ResponseEntity.ok(feedService.getAllCategories());
    }

    @GetMapping("/export/csv")
    public ResponseEntity<String> exportCsv() {
        // Simple CSV generation for now
        List<FeedMaster> feeds = feedService.getAllFeeds();
        StringBuilder csv = new StringBuilder();
        csv.append("ID,FeedName,Category,ScientificName,Palatability\n");
        for (FeedMaster f : feeds) {
            csv.append(f.getId()).append(",")
               .append(f.getFeedName() != null ? f.getFeedName().replace(",", " ") : "").append(",")
               .append(f.getCategory()).append(",")
               .append(f.getScientificName()).append(",")
               .append(f.getPalatabilityRating()).append("\n");
        }
        
        return ResponseEntity.ok()
                .header("Content-Disposition", "attachment; filename=\"feeds.csv\"")
                .header("Content-Type", "text/csv")
                .body(csv.toString());
    }
    
    @PostMapping("/{id}/image")
    public ResponseEntity<FeedMaster> uploadImage(@PathVariable Long id, @RequestParam("file") MultipartFile file) {
        // Mock image upload logic for now since this is phase 1
        Optional<FeedResponseDTO> feedOpt = feedService.getFeedDetails(id);
        if (feedOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        FeedMaster feed = feedOpt.get().getFeed();
        
        // normally we would upload to R2 and get URL
        // for now just generate a fake URL based on file name
        String dummyUrl = "https://example.com/images/" + System.currentTimeMillis() + "_" + file.getOriginalFilename();
        feed.setImageUrl(dummyUrl);
        feedService.saveFeed(feed);
        
        return ResponseEntity.ok(feed);
    }
}
