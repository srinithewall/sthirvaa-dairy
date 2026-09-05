package com.dairy.dto.optimizer;

/** Per-nutrient evaluation: {"dryMatter": {"current": 12.8, "required": 15.0, "status": "DEFICIENT"}} */
public class NutrientStatusDTO {
    private Double current;
    private Double required;
    private String status; // ADEQUATE | DEFICIENT | EXCESS

    public NutrientStatusDTO() {}

    public NutrientStatusDTO(Double current, Double required, String status) {
        this.current = current;
        this.required = required;
        this.status = status;
    }

    public Double getCurrent() { return current; }
    public void setCurrent(Double current) { this.current = current; }

    public Double getRequired() { return required; }
    public void setRequired(Double required) { this.required = required; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
}
