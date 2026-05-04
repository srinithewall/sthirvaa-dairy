package com.dairy.service;

import com.dairy.model.Inventory;
import com.dairy.repo.InventoryRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.Optional;

@Service
public class InventoryService {
    @Autowired
    private InventoryRepository inventoryRepository;

    public List<Inventory> getAllInventory() {
        return inventoryRepository.findAll();
    }

    public Optional<Inventory> getInventoryByItem(String itemName) {
        return inventoryRepository.findByItemName(itemName);
    }

    @Transactional
    public void updateStock(String itemName, Double quantityChange, String unit) {
        Inventory item = inventoryRepository.findByItemName(itemName)
                .orElseGet(() -> {
                    Inventory newInv = new Inventory();
                    newInv.setItemName(itemName);
                    newInv.setQuantity(0.0);
                    newInv.setUnit(unit);
                    return newInv;
                });
        
        item.setQuantity(item.getQuantity() + quantityChange);
        inventoryRepository.save(item);
    }
    
    public Inventory saveInventory(Inventory inventory) {
        return inventoryRepository.save(inventory);
    }

    public void deleteInventory(Long id) {
        inventoryRepository.deleteById(id);
    }
}
