package com.dairy.dto.ration;

import com.dairy.model.ration.RationItem;
import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

/** A batch with its ration lines and the animals in it. Items sent on save replace the batch's lines; herdIds, if sent, replaces who is in it. */
@Getter
@Setter
public class RationGroupDTO {
    private Long id;
    private String name;
    private String color;
    private String notes;
    private Integer sortOrder;
    private List<RationItem> items = new ArrayList<>();
    private List<Long> herdIds;
}
