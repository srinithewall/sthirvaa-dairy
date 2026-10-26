package com.dairy.service.store;

import com.dairy.model.store.StoreFarmer;
import com.dairy.model.store.StoreItem;
import com.dairy.model.store.StoreSupplier;
import com.dairy.repo.store.StoreFarmerRepository;
import com.dairy.repo.store.StoreItemRepository;
import com.dairy.repo.store.StoreSupplierRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/** Items, suppliers and farmers. Records are deactivated, never deleted, so history stays intact. */
@Service
public class StoreMasterService {

    private final StoreItemRepository itemRepository;
    private final StoreSupplierRepository supplierRepository;
    private final StoreFarmerRepository farmerRepository;

    public StoreMasterService(StoreItemRepository itemRepository, StoreSupplierRepository supplierRepository,
                              StoreFarmerRepository farmerRepository) {
        this.itemRepository = itemRepository;
        this.supplierRepository = supplierRepository;
        this.farmerRepository = farmerRepository;
    }

    // ---- Items ----

    public List<StoreItem> items(boolean includeInactive) {
        return includeInactive ? itemRepository.findAllByOrderByNameAsc() : itemRepository.findByActiveTrueOrderByNameAsc();
    }

    public StoreItem item(Long id) {
        return itemRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Item not found"));
    }

    @Transactional
    public StoreItem saveItem(Long id, StoreItem in) {
        return saveItem(id, in, true);
    }

    /** canSeeCost=false (STAFF): a hidden item's minSalePrice and hidePrice flag are kept as stored. */
    @Transactional
    public StoreItem saveItem(Long id, StoreItem in, boolean canSeeCost) {
        if (in.getName() == null || in.getName().isBlank()) throw new IllegalArgumentException("Item name is required");
        if (in.getCategory() == null) throw new IllegalArgumentException("Category is required");
        if (in.getUnit() == null) throw new IllegalArgumentException("Unit is required");
        StoreStockService.requirePositive(in.getSalePrice(), "Sale price");
        StoreItem existing = id == null ? null : item(id);
        boolean keepCost = !canSeeCost && existing != null && existing.isHidePrice();
        java.math.BigDecimal minSalePrice = keepCost ? existing.getMinSalePrice() : in.getMinSalePrice();
        if (minSalePrice != null && minSalePrice.compareTo(in.getSalePrice()) > 0) {
            throw new IllegalArgumentException("Minimum sale price cannot be above sale price");
        }
        String name = in.getName().trim();
        boolean duplicate = id == null ? itemRepository.existsByNameIgnoreCase(name)
                : itemRepository.existsByNameIgnoreCaseAndIdNot(name, id);
        if (duplicate) throw new IllegalArgumentException("An item named '" + name + "' already exists");

        StoreItem item = existing == null ? new StoreItem() : existing;
        item.setName(name);
        item.setKannadaName(in.getKannadaName());
        item.setCategory(in.getCategory());
        item.setBrand(in.getBrand());
        item.getSupplierIds().clear();
        if (in.getSupplierIds() != null) item.getSupplierIds().addAll(in.getSupplierIds());
        item.setUnit(in.getUnit());
        item.setUnitSize(in.getUnitSize());
        item.setSalePrice(in.getSalePrice());
        item.setMinSalePrice(minSalePrice);
        if (!keepCost) item.setHidePrice(in.isHidePrice());
        // Which items can be taken with diamonds, and for how many, is the owner's call.
        if (canSeeCost) {
            Integer coins = in.getRewardCoins();
            if (coins != null && coins < 0) throw new IllegalArgumentException("Diamonds needed cannot be negative");
            item.setRewardCoins(coins != null && coins > 0 ? coins : null);
        }
        item.setReorderLevel(in.getReorderLevel() != null ? in.getReorderLevel() : java.math.BigDecimal.ZERO);
        item.setShelfLifeDays(in.getShelfLifeDays());
        item.setFeedMasterId(in.getFeedMasterId());
        item.setHsnCode(in.getHsnCode());
        item.setGstRate(in.getGstRate());
        item.setActive(id == null || in.isActive());
        stamp(item, id == null);
        return itemRepository.save(item);
    }

    // ---- Suppliers ----

    public List<StoreSupplier> suppliers() {
        return supplierRepository.findAllByOrderByNameAsc();
    }

    @Transactional
    public StoreSupplier saveSupplier(Long id, StoreSupplier in) {
        if (in.getName() == null || in.getName().isBlank()) throw new IllegalArgumentException("Supplier name is required");
        StoreSupplier s = id == null ? new StoreSupplier()
                : supplierRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Supplier not found"));
        s.setName(in.getName().trim());
        s.setPhone(in.getPhone());
        s.setGstin(in.getGstin());
        s.setAddress(in.getAddress());
        s.setActive(id == null || in.isActive());
        stamp(s, id == null);
        return supplierRepository.save(s);
    }

    // ---- Farmers ----

    public List<StoreFarmer> farmers(String q) {
        return q == null || q.isBlank() ? farmerRepository.findAllByOrderByNameAsc() : farmerRepository.search(q.trim());
    }

    @Transactional
    public StoreFarmer saveFarmer(Long id, StoreFarmer in) {
        if (in.getName() == null || in.getName().isBlank()) throw new IllegalArgumentException("Contact name is required");
        // Phone is optional, but if one is typed it must be a full mobile number.
        boolean phoneGiven = in.getPhone() != null && !in.getPhone().isBlank();
        String phone = normalisePhone(in.getPhone());
        if (phoneGiven && phone == null) throw new IllegalArgumentException(PHONE_MESSAGE);
        boolean duplicate = phone != null && (id == null ? farmerRepository.findByPhone(phone).isPresent()
                : farmerRepository.existsByPhoneAndIdNot(phone, id));
        if (duplicate) throw new IllegalArgumentException("A contact with phone " + phone + " already exists");

        StoreFarmer f = id == null ? new StoreFarmer()
                : farmerRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Contact not found"));
        f.setName(in.getName().trim());
        f.setPhone(phone);
        f.setVillage(in.getVillage() == null || in.getVillage().isBlank() ? null : in.getVillage().trim());
        f.setCowsCount(in.getCowsCount());
        // Credit limits are an owner decision; staff-created farmers start with none (0 = no limit set).
        if (StoreSecurity.isAdmin()) {
            f.setCreditLimit(in.getCreditLimit() != null ? in.getCreditLimit() : java.math.BigDecimal.ZERO);
        }
        f.setActive(id == null || in.isActive());
        stamp(f, id == null);
        return farmerRepository.save(f);
    }

    static final String PHONE_MESSAGE = "Please enter a valid 10-digit mobile number, or leave it blank";

    /** Keeps the last 10 digits, so "+91 98450 12345" and "9845012345" match. */
    static String normalisePhone(String raw) {
        if (raw == null) return null;
        String digits = raw.replaceAll("\\D", "");
        if (digits.length() < 10) return null;
        return digits.substring(digits.length() - 10);
    }

    private static void stamp(com.dairy.model.store.StoreAuditable e, boolean isNew) {
        String user = StoreSecurity.currentUser();
        if (isNew) e.setCreatedBy(user);
        e.setUpdatedBy(user);
    }
}
