package com.dairy.service.store;

import com.dairy.dto.store.StoreDtos.PurchaseLineRequest;
import com.dairy.dto.store.StoreDtos.PurchaseRequest;
import com.dairy.model.store.*;
import com.dairy.repo.store.StoreItemRepository;
import com.dairy.repo.store.StorePurchaseRepository;
import com.dairy.repo.store.StoreSupplierRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Stock-in from a supplier bill: one purchase, one batch per line. */
@Service
public class StorePurchaseService {

    private final StorePurchaseRepository purchaseRepository;
    private final StoreSupplierRepository supplierRepository;
    private final StoreItemRepository itemRepository;
    private final StoreStockService stockService;
    private final StoreMasterService masterService;

    public StorePurchaseService(StorePurchaseRepository purchaseRepository, StoreSupplierRepository supplierRepository,
                                StoreItemRepository itemRepository, StoreStockService stockService,
                                StoreMasterService masterService) {
        this.purchaseRepository = purchaseRepository;
        this.supplierRepository = supplierRepository;
        this.itemRepository = itemRepository;
        this.stockService = stockService;
        this.masterService = masterService;
    }

    /** Default margin when a bill line doesn't say what to sell the item for, and the lowest allowed. */
    static final BigDecimal DEFAULT_MARGIN = new BigDecimal("0.10");
    static final BigDecimal MIN_MARGIN = new BigDecimal("0.05");

    /**
     * The bill line's item: an existing one by id, or one created (or matched by name) from newItem.
     * The line's salePrice, or cost + 5% for a brand-new item, becomes the item's selling price,
     * rounded to whole rupees.
     */
    /** Qty, cost and selling price on a bill line are at most 4 digits. */
    static final BigDecimal MAX_AMOUNT = new BigDecimal("9999");

    private StoreItem resolveItem(PurchaseLineRequest l) {
        for (BigDecimal v : new BigDecimal[] { l.qty(), l.unitCost(), l.salePrice() }) {
            if (v != null && v.compareTo(MAX_AMOUNT) > 0) {
                throw new IllegalArgumentException("Quantity, cost and selling price can be at most 9999");
            }
        }
        if (l.salePrice() != null && l.unitCost() != null
                && l.salePrice().compareTo(l.unitCost().multiply(BigDecimal.ONE.add(MIN_MARGIN))) < 0) {
            String name = l.newItem() != null ? l.newItem().getName()
                    : itemRepository.findById(l.itemId()).map(StoreItem::getName).orElse("Item");
            throw new IllegalArgumentException(name + ": selling price must be at least 5% above cost");
        }
        StoreItem item;
        if (l.itemId() != null) {
            item = itemRepository.findById(l.itemId())
                    .orElseThrow(() -> new IllegalArgumentException("Item not found: " + l.itemId()));
        } else if (l.newItem() != null && l.newItem().getName() != null && !l.newItem().getName().isBlank()) {
            item = itemRepository.findFirstByNameIgnoreCase(l.newItem().getName().trim()).orElse(null);
            if (item == null) {
                StoreItem in = l.newItem();
                if (in.getCategory() == null) in.setCategory(StoreItemCategory.FEED);
                if (in.getUnit() == null) in.setUnit(StoreUnit.BAG);
                in.setSalePrice(l.salePrice() != null ? l.salePrice()
                        : l.unitCost().multiply(BigDecimal.ONE.add(DEFAULT_MARGIN)));
                in.setSalePrice(in.getSalePrice().setScale(0, RoundingMode.HALF_UP));
                return masterService.saveItem(null, in);
            }
        } else {
            throw new IllegalArgumentException("Pick an item or enter a new item name on every line");
        }
        if (l.salePrice() != null) {
            BigDecimal price = l.salePrice().setScale(0, RoundingMode.HALF_UP);
            StoreStockService.requirePositive(price, "Selling price of " + item.getName());
            item.setSalePrice(price);
            if (item.getMinSalePrice() != null && item.getMinSalePrice().compareTo(price) > 0) item.setMinSalePrice(price);
        }
        return item;
    }

    public List<StorePurchase> list(LocalDate from, LocalDate to) {
        return purchaseRepository.findByPurchaseDateBetweenOrderByPurchaseDateDescIdDesc(from, to);
    }

    public StorePurchase get(Long id) {
        return purchaseRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Purchase not found"));
    }

    @Transactional
    public StorePurchase create(PurchaseRequest req) {
        return save(new StorePurchase(), req);
    }

    /**
     * Edits a bill. Untouched lines are reversed and re-received. A line whose stock has already
     * been sold or moved can only be edited by ADMIN, and only in place: same item at the same
     * position, quantity not below what has gone out. Its batch is then adjusted rather than replaced.
     */
    @Transactional
    public StorePurchase update(Long id, PurchaseRequest req) {
        if (req.lines() == null || req.lines().isEmpty()) {
            throw new IllegalArgumentException("Add at least one item to the purchase");
        }
        StorePurchase purchase = get(id);
        boolean admin = StoreSecurity.isAdmin();
        Map<Integer, StoreStockBatch> usedBatches = new HashMap<>();
        List<StorePurchaseLine> oldLines = purchase.getLines();
        for (int i = 0; i < oldLines.size(); i++) {
            StorePurchaseLine line = oldLines.get(i);
            String name = line.getItem().getName();
            StoreStockBatch batch = stockService.purchaseBatch(line.getId());
            BigDecimal used = batch == null ? BigDecimal.ZERO : batch.getQtyReceived().subtract(batch.getQtyRemaining());
            if (used.signum() == 0) {
                stockService.reversePurchaseLine(line.getId(), name, purchase.getId());
                continue;
            }
            if (!admin) {
                throw new IllegalArgumentException(name + " from this bill is already sold or moved, so only an admin can edit the bill.");
            }
            PurchaseLineRequest edited = i < req.lines().size() ? req.lines().get(i) : null;
            if (edited == null || !line.getItem().getId().equals(edited.itemId())) {
                throw new IllegalArgumentException(name + " from this bill is already sold, so it can't be removed or changed to another item.");
            }
            if (edited.qty() == null || edited.qty().compareTo(used) < 0) {
                throw new IllegalArgumentException(name + ": quantity can't be less than the "
                        + used.stripTrailingZeros().toPlainString() + " already sold or moved.");
            }
            usedBatches.put(i, batch);
        }
        purchase.getLines().clear();
        purchase.setSupplier(null);
        return save(purchase, req, usedBatches);
    }

    /** Deletes a bill and takes its stock back out. Only while none of that stock has been sold or moved. */
    @Transactional
    public void delete(Long id) {
        StorePurchase purchase = get(id);
        for (StorePurchaseLine line : purchase.getLines()) {
            stockService.reversePurchaseLine(line.getId(), line.getItem().getName(), purchase.getId(), true);
        }
        purchaseRepository.delete(purchase);
    }

    private StorePurchase save(StorePurchase purchase, PurchaseRequest req) {
        return save(purchase, req, Map.of());
    }

    /** usedBatches: line index → existing batch to adjust in place instead of receiving a new one. */
    private StorePurchase save(StorePurchase purchase, PurchaseRequest req, Map<Integer, StoreStockBatch> usedBatches) {
        if (req.lines() == null || req.lines().isEmpty()) {
            throw new IllegalArgumentException("Add at least one item to the purchase");
        }
        if (req.supplierId() != null) {
            purchase.setSupplier(supplierRepository.findById(req.supplierId())
                    .orElseThrow(() -> new IllegalArgumentException("Supplier not found")));
        }
        purchase.setBillNo(req.billNo());
        purchase.setPurchaseDate(req.purchaseDate() != null ? req.purchaseDate() : LocalDate.now());
        purchase.setNotes(req.notes());
        String user = StoreSecurity.currentUser();
        if (purchase.getId() == null) purchase.setCreatedBy(user);
        purchase.setUpdatedBy(user);

        BigDecimal total = BigDecimal.ZERO;
        for (PurchaseLineRequest l : req.lines()) {
            StoreStockService.requirePositive(l.qty(), "Quantity");
            if (l.unitCost() == null || l.unitCost().signum() < 0) {
                throw new IllegalArgumentException("Unit cost must be zero or more");
            }
            StoreItem item = resolveItem(l);
            // Remember that this supplier sells this item, so it's listed first on their next bill.
            if (purchase.getSupplier() != null) item.getSupplierIds().add(purchase.getSupplier().getId());
            StorePurchaseLine line = new StorePurchaseLine();
            line.setPurchase(purchase);
            line.setItem(item);
            line.setQty(l.qty());
            line.setUnitCost(l.unitCost());
            line.setLineTotal(l.qty().multiply(l.unitCost()).setScale(2, RoundingMode.HALF_UP));
            line.setBatchNo(l.batchNo());
            line.setExpiryDate(l.expiryDate());
            purchase.getLines().add(line);
            total = total.add(line.getLineTotal());
        }
        purchase.setTotal(total);
        BigDecimal paid = req.paid() != null ? req.paid() : total;
        if (paid.signum() < 0 || paid.compareTo(total) > 0) {
            throw new IllegalArgumentException("Paid amount must be between 0 and the bill total");
        }
        purchase.setPaid(paid);
        purchase = purchaseRepository.save(purchase);

        for (int i = 0; i < purchase.getLines().size(); i++) {
            StorePurchaseLine line = purchase.getLines().get(i);
            StoreStockBatch batch = usedBatches.get(i);
            if (batch != null) {
                stockService.updatePurchaseBatch(batch, line, purchase.getPurchaseDate(), purchase.getId());
                continue;
            }
            stockService.receive(line.getItem(), line.getQty(), line.getUnitCost(), line.getBatchNo(),
                    line.getExpiryDate(), purchase.getPurchaseDate(), line.getId(),
                    StoreMoveType.PURCHASE, "PURCHASE", purchase.getId(), null);
        }
        return purchase;
    }
}
