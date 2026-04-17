package com.dairy.service;

import com.dairy.model.Purchase;
import com.dairy.repo.PurchaseRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
public class PurchaseService {
    @Autowired
    private PurchaseRepository purchaseRepository;

    @Autowired
    private InventoryService inventoryService;

    public List<Purchase> getAllPurchases() {
        return purchaseRepository.findAll();
    }

    @Transactional
    public Purchase savePurchase(Purchase purchase) {
        if (purchase.getTotalAmount() == null) {
            purchase.setTotalAmount(purchase.getQuantity() * purchase.getPrice());
        }
        Purchase saved = purchaseRepository.save(purchase);
        // Purchase INCREASES stock
        inventoryService.updateStock(purchase.getItemName(), purchase.getQuantity(), purchase.getUnit());
        return saved;
    }
}
