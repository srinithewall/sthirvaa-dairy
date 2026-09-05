package com.dairy.dto.optimizer;

/**
 * One ADD or REDUCE line. Carries the structured numeric quantity (feedId/quantityKg/unit)
 * for correct programmatic use, plus a pre-formatted "amount" string and "name" field to
 * match the already-built frontend's rec.amount / rec.name rendering contract.
 */
public class FeedAdjustmentDTO {
    private Long feedId;
    private String name;
    private Double quantityKg;
    private String unit = "kg";
    private String amount;

    public FeedAdjustmentDTO() {}

    public FeedAdjustmentDTO(Long feedId, String name, Double quantityKg) {
        this.feedId = feedId;
        this.name = name;
        this.quantityKg = quantityKg;
        this.amount = String.format("%.2f kg", quantityKg);
    }

    public Long getFeedId() { return feedId; }
    public void setFeedId(Long feedId) { this.feedId = feedId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public Double getQuantityKg() { return quantityKg; }
    public void setQuantityKg(Double quantityKg) { this.quantityKg = quantityKg; }

    public String getUnit() { return unit; }
    public void setUnit(String unit) { this.unit = unit; }

    public String getAmount() { return amount; }
    public void setAmount(String amount) { this.amount = amount; }
}
