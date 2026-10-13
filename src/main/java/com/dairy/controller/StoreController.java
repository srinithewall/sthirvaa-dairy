package com.dairy.controller;

import com.dairy.dto.store.StoreDtos.*;
import com.dairy.model.store.*;
import com.dairy.service.store.*;
import org.springframework.beans.BeanUtils;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

/**
 * Feed Store API. Operators (ADMIN, PARTNER, STAFF) bill and stock-in;
 * and manage items; stock adjustments are limited to ADMIN and PARTNER. Items marked
 * hidePrice have their min (cost) price hidden from STAFF.
 */
@RestController
@RequestMapping("/api/store")
@PreAuthorize("hasAnyRole('ADMIN','PARTNER','STAFF')")
public class StoreController {

    private final StoreMasterService masterService;
    private final StoreStockService stockService;
    private final StorePurchaseService purchaseService;
    private final StoreSaleService saleService;
    private final StoreDashboardService dashboardService;
    private final StoreLedgerService ledgerService;

    public StoreController(StoreMasterService masterService, StoreStockService stockService,
                           StorePurchaseService purchaseService, StoreSaleService saleService,
                           StoreDashboardService dashboardService, StoreLedgerService ledgerService) {
        this.ledgerService = ledgerService;
        this.masterService = masterService;
        this.stockService = stockService;
        this.purchaseService = purchaseService;
        this.saleService = saleService;
        this.dashboardService = dashboardService;
    }

    // ---- Dashboard ----

    @GetMapping("/dashboard")
    public Dashboard dashboard(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return dashboardService.dashboard(date != null ? date : LocalDate.now());
    }

    // ---- Items ----

    @GetMapping("/items")
    public List<StoreItem> items(@RequestParam(defaultValue = "false") boolean includeInactive, Authentication auth) {
        boolean canSeeCost = canSeeCost(auth);
        return masterService.items(includeInactive).stream().map(i -> visible(i, canSeeCost)).toList();
    }

    @PostMapping("/items")
    public StoreItem createItem(@RequestBody StoreItem item, Authentication auth) {
        boolean canSeeCost = canSeeCost(auth);
        return visible(masterService.saveItem(null, item, canSeeCost), canSeeCost);
    }

    @PutMapping("/items/{id}")
    public StoreItem updateItem(@PathVariable Long id, @RequestBody StoreItem item, Authentication auth) {
        boolean canSeeCost = canSeeCost(auth);
        return visible(masterService.saveItem(id, item, canSeeCost), canSeeCost);
    }

    private static boolean canSeeCost(Authentication auth) {
        return auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN") || a.getAuthority().equals("ROLE_PARTNER"));
    }

    /** Returns a detached copy with minSalePrice blanked when the item is price-hidden from this caller. */
    private static StoreItem visible(StoreItem item, boolean canSeeCost) {
        if (canSeeCost || !item.isHidePrice()) return item;
        StoreItem copy = new StoreItem();
        BeanUtils.copyProperties(item, copy);
        copy.setMinSalePrice(null);
        return copy;
    }

    // ---- Suppliers ----

    @GetMapping("/suppliers")
    public List<StoreSupplier> suppliers() {
        return masterService.suppliers();
    }

    @PostMapping("/suppliers")
    public StoreSupplier createSupplier(@RequestBody StoreSupplier supplier) {
        return masterService.saveSupplier(null, supplier);
    }

    @PutMapping("/suppliers/{id}")
    public StoreSupplier updateSupplier(@PathVariable Long id, @RequestBody StoreSupplier supplier) {
        return masterService.saveSupplier(id, supplier);
    }

    // ---- Farmers ----

    @GetMapping("/farmers")
    public List<StoreFarmer> farmers(@RequestParam(required = false) String q) {
        return masterService.farmers(q);
    }

    @PostMapping("/farmers")
    public StoreFarmer createFarmer(@RequestBody StoreFarmer farmer) {
        return masterService.saveFarmer(null, farmer);
    }

    @PutMapping("/farmers/{id}")
    public StoreFarmer updateFarmer(@PathVariable Long id, @RequestBody StoreFarmer farmer) {
        return masterService.saveFarmer(id, farmer);
    }

    /** All farmers with balance owed and last visit, biggest balance first. */
    @GetMapping("/farmers/accounts")
    public List<FarmerSummary> farmerAccounts() {
        return ledgerService.accounts();
    }

    /** Balance owed, last visit and recent credit/payment entries. */
    @GetMapping("/farmers/{id}/account")
    public FarmerAccount farmerAccount(@PathVariable Long id) {
        return ledgerService.account(id);
    }

    @PostMapping("/farmers/{id}/payments")
    public FarmerAccount receivePayment(@PathVariable Long id, @RequestBody PaymentRequest request) {
        return ledgerService.receivePayment(id, request);
    }

    // ---- Purchases (stock-in) ----

    @GetMapping("/purchases")
    public List<StorePurchase> purchases(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        LocalDate end = to != null ? to : LocalDate.now();
        return purchaseService.list(from != null ? from : end.minusDays(30), end);
    }

    @GetMapping("/purchases/{id}")
    public StorePurchase purchase(@PathVariable Long id) {
        return purchaseService.get(id);
    }

    @PostMapping("/purchases")
    public StorePurchase createPurchase(@RequestBody PurchaseRequest request) {
        return purchaseService.create(request);
    }

    @DeleteMapping("/purchases/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public void deletePurchase(@PathVariable Long id) {
        purchaseService.delete(id);
    }

    @PutMapping("/purchases/{id}")
    public StorePurchase updatePurchase(@PathVariable Long id, @RequestBody PurchaseRequest request) {
        return purchaseService.update(id, request);
    }

    // ---- Sales (bills) ----

    @GetMapping("/sales")
    public List<StoreSale> sales(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        LocalDate end = to != null ? to : LocalDate.now();
        return saleService.list(from != null ? from : end, end);
    }

    @GetMapping("/sales/{id}")
    public StoreSale sale(@PathVariable Long id) {
        return saleService.get(id);
    }

    @PostMapping("/sales")
    public StoreSale createSale(@RequestBody SaleRequest request) {
        return saleService.create(request);
    }

    // ---- Stock ----

    @GetMapping("/stock")
    public List<StockRow> stock(@RequestParam(defaultValue = "false") boolean includeInactive, Authentication auth) {
        boolean canSeeCost = canSeeCost(auth);
        return stockService.stock(includeInactive).stream()
                .map(r -> new StockRow(visible(r.item(), canSeeCost), r.qtyOnHand(), r.stockValue(), r.earliestExpiry(), r.lowStock()))
                .toList();
    }

    @GetMapping("/stock/expiring")
    public List<ExpiringBatch> expiring(@RequestParam(defaultValue = "30") int days) {
        return stockService.expiring(days);
    }

    @GetMapping("/stock/moves")
    public List<StoreStockMove> moves(@RequestParam Long itemId) {
        return stockService.moves(itemId);
    }

    @PostMapping("/stock/adjust")
    @PreAuthorize("hasAnyRole('ADMIN','PARTNER')")
    public void adjust(@RequestBody StockAdjustRequest request) {
        stockService.adjust(request);
    }
}
