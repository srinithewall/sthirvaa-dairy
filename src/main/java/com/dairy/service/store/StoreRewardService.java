package com.dairy.service.store;

import com.dairy.model.Setting;
import com.dairy.model.store.StoreFarmer;
import com.dairy.model.store.StoreRewardEntry;
import com.dairy.model.store.StoreRewardType;
import com.dairy.repo.store.StoreRewardRepository;
import com.dairy.repository.SettingRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Sthirvaa Diamonds: contacts earn diamonds on money they pay (at billing or when clearing dues) and
 * spend them on items the owner has marked redeemable. The earn rate is a setting so the owner can
 * change it without a release.
 */
@Service
public class StoreRewardService {

    /** settings key: diamonds earned per ₹1,000 paid. */
    public static final String RATE_KEY = "store_reward_coins_per_1000";
    public static final int DEFAULT_RATE = 10;

    private final StoreRewardRepository rewardRepository;
    private final SettingRepository settingRepository;

    public StoreRewardService(StoreRewardRepository rewardRepository, SettingRepository settingRepository) {
        this.rewardRepository = rewardRepository;
        this.settingRepository = settingRepository;
    }

    public int coinsPer1000() {
        try {
            return settingRepository.findById(RATE_KEY).map(Setting::getSettingValue)
                    .map(String::trim).filter(v -> !v.isEmpty()).map(Integer::parseInt)
                    .filter(v -> v >= 0).orElse(DEFAULT_RATE);
        } catch (NumberFormatException e) {
            return DEFAULT_RATE;
        }
    }

    /** Whole diamonds earned on an amount paid; part-diamonds are dropped. */
    public int coinsFor(BigDecimal paid) {
        if (paid == null || paid.signum() <= 0) return 0;
        return paid.multiply(BigDecimal.valueOf(coinsPer1000()))
                .divide(BigDecimal.valueOf(1000), 0, RoundingMode.FLOOR).intValue();
    }

    public int balance(Long farmerId) {
        return (int) rewardRepository.balance(farmerId);
    }

    public Map<Long, Integer> balances() {
        Map<Long, Integer> out = new HashMap<>();
        for (Object[] r : rewardRepository.balances()) out.put((Long) r[0], ((Number) r[1]).intValue());
        return out;
    }

    public List<StoreRewardEntry> recent(Long farmerId) {
        return rewardRepository.findTop50ByFarmerIdOrderByEntryDateDescIdDesc(farmerId);
    }

    /** Adds an entry; zero coins are not recorded. Called inside the caller's transaction. */
    void record(StoreFarmer farmer, LocalDate date, StoreRewardType type, int coins, Long saleId, String notes) {
        if (farmer == null || coins == 0) return;
        StoreRewardEntry e = new StoreRewardEntry();
        e.setFarmer(farmer);
        e.setEntryDate(date);
        e.setType(type);
        e.setCoins(coins);
        e.setSaleId(saleId);
        e.setNotes(notes);
        String user = StoreSecurity.currentUser();
        e.setCreatedBy(user);
        e.setUpdatedBy(user);
        rewardRepository.save(e);
    }

    /** Drops what a bill earned and spent, when the bill is edited or deleted. */
    void removeForSale(Long saleId) {
        rewardRepository.deleteBySaleId(saleId);
    }
}
