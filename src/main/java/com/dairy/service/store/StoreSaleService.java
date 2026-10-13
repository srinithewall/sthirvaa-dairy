package com.dairy.service.store;

import com.dairy.dto.store.StoreDtos.SaleLineRequest;
import com.dairy.dto.store.StoreDtos.SaleRequest;
import com.dairy.model.store.*;
import com.dairy.repo.store.StoreFarmerRepository;
import com.dairy.repo.store.StoreItemRepository;
import com.dairy.repo.store.StoreSaleRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;

/** Customer billing. Each line is costed from the FIFO batches it consumes. */
@Service
public class StoreSaleService {

    static final String BILL_PREFIX = "FS-";

    private final StoreSaleRepository saleRepository;
    private final StoreItemRepository itemRepository;
    private final StoreFarmerRepository farmerRepository;
    private final StoreStockService stockService;
    private final StoreLedgerService ledgerService;

    public StoreSaleService(StoreSaleRepository saleRepository, StoreItemRepository itemRepository,
                            StoreFarmerRepository farmerRepository, StoreStockService stockService,
                            StoreLedgerService ledgerService) {
        this.saleRepository = saleRepository;
        this.itemRepository = itemRepository;
        this.farmerRepository = farmerRepository;
        this.stockService = stockService;
        this.ledgerService = ledgerService;
    }

    public List<StoreSale> list(LocalDate from, LocalDate to) {
        return saleRepository.findBySaleDateBetweenOrderBySaleDateDescIdDesc(from, to);
    }

    public StoreSale get(Long id) {
        return saleRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Bill not found"));
    }

    @Transactional
    public StoreSale create(SaleRequest req) {
        if (req.lines() == null || req.lines().isEmpty()) {
            throw new IllegalArgumentException("Add at least one item to the bill");
        }
        // CASH/UPI: paid in full. CREDIT: nothing paid now. MIXED: part paid now (paidAmount), rest on credit.
        StorePaymentMode mode = req.paymentMode() != null ? req.paymentMode() : StorePaymentMode.CASH;
        boolean onCredit = mode == StorePaymentMode.CREDIT || mode == StorePaymentMode.MIXED;
        if (onCredit && req.farmerId() == null) {
            throw new IllegalArgumentException("Pick a contact to give credit — walk-in bills must be paid in full");
        }

        StoreSale sale = new StoreSale();
        sale.setSaleDate(req.saleDate() != null ? req.saleDate() : LocalDate.now());
        if (sale.getSaleDate().isAfter(LocalDate.now())) {
            throw new IllegalArgumentException("Bill date cannot be in the future");
        }
        if (req.farmerId() != null) {
            StoreFarmer farmer = farmerRepository.findById(req.farmerId())
                    .orElseThrow(() -> new IllegalArgumentException("Contact not found"));
            sale.setFarmer(farmer);
            sale.setCustomerName(farmer.getName());
            sale.setCustomerPhone(farmer.getPhone());
        } else {
            sale.setCustomerName(blankToNull(req.customerName()));
            sale.setCustomerPhone(StoreMasterService.normalisePhone(req.customerPhone()));
        }
        sale.setType(StoreSaleType.CUSTOMER);
        sale.setPaymentMode(mode);
        sale.setNotes(req.notes());
        String user = StoreSecurity.currentUser();
        sale.setCreatedBy(user);
        sale.setUpdatedBy(user);

        boolean admin = StoreSecurity.isAdmin();
        BigDecimal subtotal = BigDecimal.ZERO;
        for (SaleLineRequest l : req.lines()) {
            StoreStockService.requirePositive(l.qty(), "Quantity");
            StoreItem item = itemRepository.findById(l.itemId())
                    .orElseThrow(() -> new IllegalArgumentException("Item not found: " + l.itemId()));
            if (!item.isActive()) throw new IllegalArgumentException(item.getName() + " is no longer sold");
            BigDecimal price = l.unitPrice() != null ? l.unitPrice() : item.getSalePrice();
            StoreStockService.requirePositive(price, "Price of " + item.getName());
            if (!admin && item.getMinSalePrice() != null && price.compareTo(item.getMinSalePrice()) < 0) {
                throw new IllegalArgumentException(item.isHidePrice()
                        ? "Price of " + item.getName() + " is below the allowed minimum (owner approval needed)"
                        : "Price of " + item.getName() + " cannot be below ₹"
                                + item.getMinSalePrice().toPlainString() + " (owner approval needed)");
            }
            StoreSaleLine line = new StoreSaleLine();
            line.setSale(sale);
            line.setItem(item);
            line.setQty(l.qty());
            line.setUnitPrice(price);
            line.setLineTotal(l.qty().multiply(price).setScale(2, RoundingMode.HALF_UP));
            line.setUnitCost(BigDecimal.ZERO); // filled in after stock is consumed
            sale.getLines().add(line);
            subtotal = subtotal.add(line.getLineTotal());
        }

        BigDecimal discount = req.discount() != null ? req.discount() : BigDecimal.ZERO;
        if (discount.signum() < 0 || discount.compareTo(subtotal) > 0) {
            throw new IllegalArgumentException("Discount must be between 0 and the bill subtotal");
        }
        sale.setSubtotal(subtotal);
        sale.setDiscount(discount);
        sale.setTotal(subtotal.subtract(discount));
        BigDecimal paid = switch (mode) {
            case CREDIT -> BigDecimal.ZERO;
            case MIXED -> req.paidAmount() != null ? req.paidAmount() : BigDecimal.ZERO;
            default -> sale.getTotal();
        };
        if (mode == StorePaymentMode.MIXED && (paid.signum() <= 0 || paid.compareTo(sale.getTotal()) >= 0)) {
            throw new IllegalArgumentException("For part payment, the amount paid now must be more than 0 and less than the total");
        }
        sale.setPaidAmount(paid);
        BigDecimal due = sale.getTotal().subtract(paid);
        if (onCredit && !admin) {
            StoreFarmer farmer = sale.getFarmer();
            BigDecimal limit = farmer.getCreditLimit();
            BigDecimal owed = ledgerService.balance(farmer.getId());
            // A limit of 0 means no limit has been set for this farmer.
            if (limit != null && limit.signum() > 0 && owed.add(due).compareTo(limit) > 0) {
                throw new IllegalArgumentException(farmer.getName() + "'s credit limit is ₹" + limit.setScale(0, RoundingMode.HALF_UP)
                        + " and they already owe ₹" + owed.setScale(0, RoundingMode.HALF_UP) + " (owner approval needed)");
            }
        }
        sale = saleRepository.save(sale);

        BigDecimal costTotal = BigDecimal.ZERO;
        for (StoreSaleLine line : sale.getLines()) {
            BigDecimal cost = stockService.consume(line.getItem(), line.getQty(), StoreMoveType.SALE,
                    "SALE", sale.getId(), null);
            line.setUnitCost(cost.divide(line.getQty(), 4, RoundingMode.HALF_UP));
            costTotal = costTotal.add(cost);
        }
        sale.setCostTotal(costTotal.setScale(2, RoundingMode.HALF_UP));
        sale.setBillNo(BILL_PREFIX + String.format("%06d", sale.getId()));
        if (due.signum() > 0) ledgerService.recordCredit(sale, due);
        return saleRepository.save(sale);
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
