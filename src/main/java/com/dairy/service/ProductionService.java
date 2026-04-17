package com.dairy.service;

import com.dairy.model.Production;
import com.dairy.repo.ProductionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
public class ProductionService {
    @Autowired
    private ProductionRepository productionRepository;
    
    @Autowired
    private InventoryService inventoryService;

    public List<Production> getAllProductions() {
        return productionRepository.findAll();
    }

    @Transactional
    public Production saveProduction(Production production) {
        Production saved = productionRepository.save(production);
        // Production INCREASES stock
        inventoryService.updateStock(production.getItemName(), production.getQuantity(), production.getUnit());
        return saved;
    }
}
