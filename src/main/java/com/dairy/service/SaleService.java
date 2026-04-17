package com.dairy.service;

import com.dairy.model.Sale;
import com.dairy.repo.SaleRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Service
public class SaleService {

    @Autowired
    private SaleRepository saleRepository;

    @Autowired
    private InventoryService inventoryService;

    public List<Sale> getAllSales() {
        return saleRepository.findAll();
    }

    public Optional<Sale> getSaleById(Long id) {
        return saleRepository.findById(id);
    }

    @Transactional
    public Sale saveSale(Sale sale) {
        // Ensure total amount is calculated if not provided
        if (sale.getTotalAmount() == null && sale.getQuantity() != null && sale.getPrice() != null) {
            sale.setTotalAmount(sale.getQuantity() * sale.getPrice());
        }
        Sale saved = saleRepository.save(sale);
        // Sales DECREASES stock (negative quantity)
        inventoryService.updateStock(sale.getItemName(), -sale.getQuantity(), "UNIT"); 
        return saved;
    }

    public void deleteSale(Long id) {
        saleRepository.deleteById(id);
    }

    public List<Sale> getSalesByCustomer(Long customerId) {
        return saleRepository.findByCustomerId(customerId);
    }

    public List<Sale> getSalesByDateRange(LocalDate start, LocalDate end) {
        return saleRepository.findByDateBetween(start, end);
    }

    public Double getTotalIncomeByDateRange(LocalDate start, LocalDate end) {
        return saleRepository.findByDateBetween(start, end)
                .stream()
                .mapToDouble(Sale::getTotalAmount)
                .sum();
    }
}
