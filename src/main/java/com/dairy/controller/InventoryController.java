package com.dairy.controller;

import com.dairy.model.Inventory;
import com.dairy.service.InventoryService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/inventory")
public class InventoryController {
    @Autowired
    private InventoryService inventoryService;

    @GetMapping
    public List<Inventory> getAllInventory() {
        return inventoryService.getAllInventory();
    }

    @GetMapping("/{itemName}")
    public Inventory getInventoryByItem(@PathVariable String itemName) {
        return inventoryService.getInventoryByItem(itemName)
                .orElseThrow(() -> new RuntimeException("Item not found in inventory: " + itemName));
    }
}
