package com.dairy.service.store;

import com.dairy.dto.store.StoreDtos.SaleLineRequest;
import com.dairy.dto.store.StoreDtos.SaleRequest;
import com.dairy.model.store.*;
import com.dairy.model.User;
import com.dairy.repo.UserRepository;
import com.dairy.repo.store.StoreFarmerRepository;
import com.dairy.repo.store.StoreItemRepository;
import com.dairy.repo.store.StoreSaleRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

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
    private final UserRepository userRepository;

    public StoreSaleService(StoreSaleRepository saleRepository, StoreItemRepository itemRepository,
                            StoreFarmerRepository farmerRepository, StoreStockService stockService,
                            StoreLedgerService ledgerService, UserRepository userRepository) {
        this.saleRepository = saleRepository;
        this.itemRepository = itemRepository;
        this.farmerRepository = farmerRepository;
        this.stockService = stockService;
        this.ledgerService = ledgerService;
        this.userRepository = userRepository;
    }

    public List<StoreSale> list(LocalDate from, LocalDate to) {
        return saleRepository.findBySaleDateBetweenOrderBySaleDateDescIdDesc(from, to);
    }

    public StoreSale get(Long id) {
        return saleRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Bill not found"));
    }

    /** Only the user with id 1 may change or remove a bill once it has been generated. */
    public boolean canModifyBills() {
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth == null || auth.getName() == null) return false;
            User user = userRepository.findByEmail(auth.getName())
                    .orElseGet(() -> userRepository.findByUsername(auth.getName()).orElse(null));
            return user != null && Long.valueOf(1L).equals(user.getId());
        } catch (Exception ex) {
            return false;
        }
    }

    private void requireBillEditor() {
        if (!canModifyBills()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the owner account can edit or delete a generated bill.");
        }
    }

    /** Deletes a bill, putting its stock back and removing any credit it put on the contact's account. */
    @Transactional
    public void delete(Long id) {
        requireBillEditor();
        StoreSale sale = get(id);
        stockService.restoreSale(sale.getId(), "Bill " + sale.getBillNo() + " deleted");
        ledgerService.removeCredit(sale.getId());
        saleRepository.delete(sale);
    }

    /** Replaces a bill's contents in place: same bill number, stock and credit redone from the new lines. */
    @Transactional
    public StoreSale update(Long id, SaleRequest req) {
        requireBillEditor();
        StoreSale sale = get(id);
        stockService.restoreSale(sale.getId(), "Bill " + sale.getBillNo() + " edited");
        ledgerService.removeCredit(sale.getId());
        sale.getLines().clear();
        return populate(sale, req);
    }

    @Transactional
    public StoreSale create(SaleRequest req) {
        return populate(new StoreSale(), req);
    }

    /** Builds a new bill, or rebuilds an existing one, from the request, and consumes the stock. */
    private StoreSale populate(StoreSale sale, SaleRequest req) {
        boolean isNew = sale.getId() == null;
        if (req.lines() == null || req.lines().isEmpty()) {
            throw new IllegalArgumentException("Add at least one item to the bill");
        }
        // CASH/UPI: paid in full. CREDIT: nothing paid now. MIXED: part paid now (paidAmount), rest on credit.
        StorePaymentMode mode = req.paymentMode() != null ? req.paymentMode() : StorePaymentMode.CASH;
        boolean onCredit = mode == StorePaymentMode.CREDIT || mode == StorePaymentMode.MIXED;
        if (onCredit && req.farmerId() == null) {
            throw new IllegalArgumentException("Pick a contact to give credit — walk-in bills must be paid in full");
        }

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
            sale.setFarmer(null);
            sale.setCustomerName(blankToNull(req.customerName()));
            sale.setCustomerPhone(StoreMasterService.normalisePhone(req.customerPhone()));
        }
        sale.setType(StoreSaleType.CUSTOMER);
        sale.setPaymentMode(mode);
        sale.setNotes(req.notes());
        String user = StoreSecurity.currentUser();
        if (isNew) sale.setCreatedBy(user);
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
        if (sale.getBillNo() == null) sale.setBillNo(BILL_PREFIX + String.format("%06d", sale.getId()));
        if (due.signum() > 0) ledgerService.recordCredit(sale, due);
        return saleRepository.save(sale);
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
