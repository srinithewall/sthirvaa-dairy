package com.dairy.dto;

import com.dairy.model.FeedMaster;
import com.dairy.model.FeedNutrition;
import com.dairy.model.FeedKnowledge;

public class FeedResponseDTO {
    private FeedMaster feed;
    private FeedNutrition nutrition;
    private FeedKnowledge knowledge;

    public FeedResponseDTO(FeedMaster feed, FeedNutrition nutrition, FeedKnowledge knowledge) {
        this.feed = feed;
        this.nutrition = nutrition;
        this.knowledge = knowledge;
    }

    public FeedMaster getFeed() { return feed; }
    public void setFeed(FeedMaster feed) { this.feed = feed; }

    public FeedNutrition getNutrition() { return nutrition; }
    public void setNutrition(FeedNutrition nutrition) { this.nutrition = nutrition; }

    public FeedKnowledge getKnowledge() { return knowledge; }
    public void setKnowledge(FeedKnowledge knowledge) { this.knowledge = knowledge; }
}
