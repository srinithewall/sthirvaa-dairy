package com.dairy.dto.optimizer;

/** One animal a plan is assigned to, named so the UI need not re-look-up the herd. */
public class PlanAssignmentDTO {

    private Long animalId;
    private String animalName;
    private String tagNumber;

    public PlanAssignmentDTO() {}

    public PlanAssignmentDTO(Long animalId, String animalName, String tagNumber) {
        this.animalId = animalId;
        this.animalName = animalName;
        this.tagNumber = tagNumber;
    }

    public Long getAnimalId() { return animalId; }
    public void setAnimalId(Long animalId) { this.animalId = animalId; }

    public String getAnimalName() { return animalName; }
    public void setAnimalName(String animalName) { this.animalName = animalName; }

    public String getTagNumber() { return tagNumber; }
    public void setTagNumber(String tagNumber) { this.tagNumber = tagNumber; }
}
