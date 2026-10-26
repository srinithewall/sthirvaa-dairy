package com.dairy.service.store;

import com.dairy.dto.store.StoreDtos.FarmerAccount;
import com.dairy.dto.store.StoreDtos.FarmerSummary;
import com.dairy.dto.store.StoreDtos.PaymentRequest;
import com.dairy.model.store.*;
import com.dairy.repo.store.StoreFarmerRepository;
import com.dairy.repo.store.StoreLedgerRepository;
import com.dairy.repo.store.StoreSaleRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Farmer credit accounts: unpaid bill amounts and payments received. */
@Service
public class StoreLedgerService {

    private final StoreLedgerRepository ledgerRepository;
    private final StoreFarmerRepository farmerRepository;
    private final StoreSaleRepository saleRepository;
    private final StoreRewardService rewardService;

    public StoreLedgerService(StoreLedgerRepository ledgerRepository, StoreFarmerRepository farmerRepository,
                              StoreSaleRepository saleRepository, StoreRewardService rewardService) {
        this.ledgerRepository = ledgerRepository;
        this.farmerRepository = farmerRepository;
        this.saleRepository = saleRepository;
        this.rewardService = rewardService;
    }

    public BigDecimal balance(Long farmerId) {
        return ledgerRepository.balance(farmerId);
    }

    public FarmerAccount account(Long farmerId) {
        StoreFarmer farmer = farmer(farmerId);
        StoreSale last = saleRepository.findFirstByFarmerIdOrderBySaleDateDescIdDesc(farmerId);
        return new FarmerAccount(farmer, balance(farmerId), last != null ? last.getSaleDate() : null,
                ledgerRepository.findTop50ByFarmerIdOrderByEntryDateDescIdDesc(farmerId),
                rewardService.balance(farmerId), rewardService.recent(farmerId));
    }

    /** Every farmer with their balance and last visit; those owing the most first. */
    public List<FarmerSummary> accounts() {
        Map<Long, BigDecimal> balances = new HashMap<>();
        for (Object[] r : ledgerRepository.balances()) balances.put((Long) r[0], (BigDecimal) r[1]);
        Map<Long, LocalDate> visits = new HashMap<>();
        for (Object[] r : saleRepository.lastVisits()) visits.put((Long) r[0], (LocalDate) r[1]);
        Map<Long, Integer> coins = rewardService.balances();
        return farmerRepository.findAllByOrderByNameAsc().stream()
                .map(f -> new FarmerSummary(f, balances.getOrDefault(f.getId(), BigDecimal.ZERO), visits.get(f.getId()),
                        coins.getOrDefault(f.getId(), 0)))
                .sorted(Comparator.comparing(FarmerSummary::balance).reversed())
                .toList();
    }

    /** Records the unpaid part of a bill. Called inside the sale's transaction. */
    void recordCredit(StoreSale sale, BigDecimal due) {
        StoreLedgerEntry e = entry(sale.getFarmer(), sale.getSaleDate(), StoreLedgerType.SALE_CREDIT, due);
        e.setSaleId(sale.getId());
        e.setNotes("Bill " + sale.getBillNo());
        ledgerRepository.save(e);
    }

    /** Drops the unpaid amount recorded for a bill, when the bill is edited or deleted. */
    void removeCredit(Long saleId) {
        ledgerRepository.deleteBySaleId(saleId);
    }

    @Transactional
    public FarmerAccount receivePayment(Long farmerId, PaymentRequest req) {
        StoreStockService.requirePositive(req.amount(), "Payment amount");
        StoreFarmer farmer = farmer(farmerId);
        BigDecimal owed = balance(farmerId);
        if (req.amount().compareTo(owed) > 0) {
            throw new IllegalArgumentException("Payment is more than the ₹" + owed.setScale(0, java.math.RoundingMode.HALF_UP)
                    + " " + farmer.getName() + " owes");
        }
        LocalDate date = req.date() != null ? req.date() : LocalDate.now();
        if (date.isAfter(LocalDate.now())) throw new IllegalArgumentException("Payment date cannot be in the future");
        StoreLedgerEntry e = entry(farmer, date, StoreLedgerType.PAYMENT, req.amount().negate());
        e.setPaymentMode(req.paymentMode() == StorePaymentMode.UPI ? StorePaymentMode.UPI : StorePaymentMode.CASH);
        e.setNotes(req.notes());
        ledgerRepository.save(e);
        // Clearing dues earns diamonds the same as paying at the counter.
        rewardService.record(farmer, date, StoreRewardType.EARN, rewardService.coinsFor(req.amount()), null,
                "Payment of ₹" + req.amount().setScale(0, java.math.RoundingMode.HALF_UP));
        return account(farmerId);
    }

    private StoreLedgerEntry entry(StoreFarmer farmer, LocalDate date, StoreLedgerType type, BigDecimal amount) {
        StoreLedgerEntry e = new StoreLedgerEntry();
        e.setFarmer(farmer);
        e.setEntryDate(date);
        e.setType(type);
        e.setAmount(amount);
        String user = StoreSecurity.currentUser();
        e.setCreatedBy(user);
        e.setUpdatedBy(user);
        return e;
    }

    private StoreFarmer farmer(Long id) {
        return farmerRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Contact not found"));
    }
}
