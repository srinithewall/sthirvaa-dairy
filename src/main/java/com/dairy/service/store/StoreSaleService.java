package com.dairy.service.store;

import com.dairy.dto.store.StoreDtos.SaleLineRequest;
import com.dairy.dto.store.StoreDtos.SaleRequest;
import com.dairy.model.store.*;
import com.dairy.model.User;
import com.dairy.repo.UserRepository;
import com.dairy.repo.store.StoreFarmerRepository;
import com.dairy.repo.store.StoreItemRepository;
import com.dairy.repo.store.StoreSaleAuditRepository;
import com.dairy.repo.store.StoreSaleRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

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
    private final StoreRewardService rewardService;
    private final StoreSaleAuditRepository auditRepository;
    private final ObjectMapper objectMapper;

    public StoreSaleService(StoreSaleRepository saleRepository, StoreItemRepository itemRepository,
                            StoreFarmerRepository farmerRepository, StoreStockService stockService,
                            StoreLedgerService ledgerService, UserRepository userRepository,
                            StoreRewardService rewardService, StoreSaleAuditRepository auditRepository,
                            ObjectMapper objectMapper) {
        this.saleRepository = saleRepository;
        this.itemRepository = itemRepository;
        this.farmerRepository = farmerRepository;
        this.stockService = stockService;
        this.ledgerService = ledgerService;
        this.userRepository = userRepository;
        this.rewardService = rewardService;
        this.auditRepository = auditRepository;
        this.objectMapper = objectMapper;
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

    /** Deletes a bill, putting its stock back and removing any credit and diamonds it added. */
    @Transactional
    public void delete(Long id) {
        requireBillEditor();
        StoreSale sale = get(id);
        audit(sale, "DELETED", sale.getTotal(), null, "Bill deleted", snapshot(sale));
        stockService.restoreSale(sale.getId(), "Bill " + sale.getBillNo() + " deleted");
        ledgerService.removeCredit(sale.getId());
        rewardService.removeForSale(sale.getId());
        saleRepository.delete(sale);
    }

    /** Replaces a bill's contents in place: same bill number, stock, credit and diamonds redone from the new lines. */
    @Transactional
    public StoreSale update(Long id, SaleRequest req) {
        requireBillEditor();
        StoreSale sale = get(id);
        String before = snapshot(sale);
        BillView was = BillView.of(sale);
        stockService.restoreSale(sale.getId(), "Bill " + sale.getBillNo() + " edited");
        ledgerService.removeCredit(sale.getId());
        rewardService.removeForSale(sale.getId());
        sale.getLines().clear();
        StoreSale saved = populate(sale, req);
        BillView now = BillView.of(saved);
        audit(saved, "EDITED", was.total(), now.total(), changes(was, now), before);
        return saved;
    }

    @Transactional
    public StoreSale create(SaleRequest req) {
        StoreSale saved = populate(new StoreSale(), req);
        audit(saved, "CREATED", null, saved.getTotal(), saved.getLines().size() + " item(s)", null);
        return saved;
    }

    /** Change log of one bill, newest first. */
    public List<StoreSaleAudit> history(Long saleId) {
        return auditRepository.findBySaleIdOrderByIdDesc(saleId);
    }

    /** Bills deleted between the two dates (by when they were deleted), newest first. */
    public List<StoreSaleAudit> deleted(LocalDate from, LocalDate to) {
        return auditRepository.findByActionAndCreatedAtBetweenOrderByIdDesc("DELETED",
                from.atStartOfDay(), to.plusDays(1).atStartOfDay());
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
        BigDecimal rewardValue = BigDecimal.ZERO;
        int coinsNeeded = 0;
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
            if (Boolean.TRUE.equals(l.redeem())) {
                // Paid with diamonds: the line stays on the bill at its price and that amount comes off the total.
                if (sale.getFarmer() == null) throw new IllegalArgumentException("Pick a contact to pay with diamonds");
                Integer perUnit = item.getRewardCoins();
                if (perUnit == null || perUnit <= 0) {
                    throw new IllegalArgumentException(item.getName() + " can't be taken with diamonds");
                }
                if (l.qty().stripTrailingZeros().scale() > 0) {
                    throw new IllegalArgumentException("Diamonds can only be used for whole units of " + item.getName());
                }
                line.setRedeemed(true);
                coinsNeeded += l.qty().intValue() * perUnit;
                rewardValue = rewardValue.add(line.getLineTotal());
            }
            sale.getLines().add(line);
            subtotal = subtotal.add(line.getLineTotal());
        }

        BigDecimal discount = req.discount() != null ? req.discount() : BigDecimal.ZERO;
        if (discount.signum() < 0 || discount.compareTo(subtotal.subtract(rewardValue)) > 0) {
            throw new IllegalArgumentException("Discount must be between 0 and the bill subtotal");
        }
        if (coinsNeeded > 0) {
            int available = rewardService.balance(sale.getFarmer().getId());
            if (coinsNeeded > available) {
                throw new IllegalArgumentException(sale.getFarmer().getName() + " has " + available
                        + " diamonds; the items marked for diamonds need " + coinsNeeded);
            }
        }
        sale.setSubtotal(subtotal);
        sale.setDiscount(discount);
        sale.setRewardValue(rewardValue);
        sale.setCoinsRedeemed(coinsNeeded);
        sale.setTotal(subtotal.subtract(discount).subtract(rewardValue));
        BigDecimal paid = switch (mode) {
            case CREDIT -> BigDecimal.ZERO;
            case MIXED -> req.paidAmount() != null ? req.paidAmount() : BigDecimal.ZERO;
            default -> sale.getTotal();
        };
        if (mode == StorePaymentMode.MIXED && (paid.signum() <= 0 || paid.compareTo(sale.getTotal()) >= 0)) {
            throw new IllegalArgumentException("For part payment, the amount paid now must be more than 0 and less than the total");
        }
        sale.setPaidAmount(paid);
        // Diamonds are earned on money paid now; the credit part earns when it is paid off.
        sale.setCoinsEarned(sale.getFarmer() != null ? rewardService.coinsFor(paid) : 0);
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
        String note = "Bill " + sale.getBillNo();
        rewardService.record(sale.getFarmer(), sale.getSaleDate(), StoreRewardType.REDEEM, -coinsNeeded, sale.getId(), note);
        rewardService.record(sale.getFarmer(), sale.getSaleDate(), StoreRewardType.EARN, sale.getCoinsEarned(), sale.getId(), note);
        return saleRepository.save(sale);
    }

    // ---- Audit log ----

    private void audit(StoreSale sale, String action, BigDecimal before, BigDecimal after, String changes, String snapshot) {
        StoreSaleAudit a = new StoreSaleAudit();
        a.setSaleId(sale.getId());
        a.setBillNo(sale.getBillNo());
        a.setAction(action);
        a.setTotalBefore(before);
        a.setTotalAfter(after);
        a.setChanges(changes.length() > 2000 ? changes.substring(0, 1997) + "..." : changes);
        a.setSnapshot(snapshot);
        String user = StoreSecurity.currentUser();
        a.setCreatedBy(user);
        a.setUpdatedBy(user);
        auditRepository.save(a);
    }

    private String snapshot(StoreSale sale) {
        try {
            return objectMapper.writeValueAsString(sale);
        } catch (Exception e) {
            return null;
        }
    }

    /** The parts of a bill a person would compare: who, how paid, and each item's qty and rate. */
    private record BillView(String customer, StorePaymentMode mode, BigDecimal discount, BigDecimal total,
                            BigDecimal paid, LocalDate date, Map<String, StoreSaleLine> lines) {
        static BillView of(StoreSale s) {
            Map<String, StoreSaleLine> lines = new LinkedHashMap<>();
            for (StoreSaleLine l : s.getLines()) {
                lines.put(l.getItem().getName() + (l.isRedeemed() ? " (diamonds)" : ""), l);
            }
            return new BillView(s.getCustomerName() != null ? s.getCustomerName() : "Walk-in", s.getPaymentMode(),
                    s.getDiscount(), s.getTotal(), s.getPaidAmount(), s.getSaleDate(), lines);
        }
    }

    private static String changes(BillView was, BillView now) {
        List<String> out = new ArrayList<>();
        if (!was.customer().equals(now.customer())) out.add("Customer " + was.customer() + " → " + now.customer());
        if (!Objects.equals(was.date(), now.date())) out.add("Date " + was.date() + " → " + now.date());
        was.lines().forEach((name, old) -> {
            StoreSaleLine cur = now.lines().get(name);
            if (cur == null) {
                out.add("Removed " + name + " ×" + qty(old.getQty()));
                return;
            }
            if (old.getQty().compareTo(cur.getQty()) != 0) out.add(name + " qty " + qty(old.getQty()) + " → " + qty(cur.getQty()));
            if (old.getUnitPrice().compareTo(cur.getUnitPrice()) != 0) {
                out.add(name + " rate " + rs(old.getUnitPrice()) + " → " + rs(cur.getUnitPrice()));
            }
        });
        now.lines().forEach((name, cur) -> {
            if (!was.lines().containsKey(name)) out.add("Added " + name + " ×" + qty(cur.getQty()));
        });
        if (was.discount().compareTo(now.discount()) != 0) out.add("Discount " + rs(was.discount()) + " → " + rs(now.discount()));
        if (was.mode() != now.mode()) out.add("Payment " + was.mode() + " → " + now.mode());
        else if (was.paid().compareTo(now.paid()) != 0) out.add("Paid " + rs(was.paid()) + " → " + rs(now.paid()));
        return out.isEmpty() ? "Saved again with no changes" : String.join("; ", out);
    }

    private static String rs(BigDecimal v) {
        return "₹" + v.setScale(0, RoundingMode.HALF_UP).toPlainString();
    }

    private static String qty(BigDecimal v) {
        return v.stripTrailingZeros().toPlainString();
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
