package com.dairy.service.store;

import com.dairy.dto.store.StoreDtos.SaleLineRequest;
import com.dairy.dto.store.StoreDtos.SaleRequest;
import com.dairy.model.User;
import com.dairy.model.store.*;
import com.dairy.repo.UserRepository;
import com.dairy.repo.store.StoreFarmerRepository;
import com.dairy.repo.store.StoreItemRepository;
import com.dairy.repo.store.StoreRewardRepository;
import com.dairy.repo.store.StoreSaleAuditRepository;
import com.dairy.repo.store.StoreSaleRepository;
import com.dairy.repo.store.StoreSupplierRepository;
import com.dairy.repository.SettingRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Billing rules added with the reward system and the bill change log: diamonds are earned on money
 * paid and spent on reward items, every create/edit/delete is logged, and contact phone is optional.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class StoreSaleServiceRewardsAuditTest {

    @Mock private StoreSaleRepository saleRepository;
    @Mock private StoreItemRepository itemRepository;
    @Mock private StoreFarmerRepository farmerRepository;
    @Mock private StoreStockService stockService;
    @Mock private StoreLedgerService ledgerService;
    @Mock private UserRepository userRepository;
    @Mock private StoreRewardRepository rewardRepository;
    @Mock private SettingRepository settingRepository;
    @Mock private StoreSaleAuditRepository auditRepository;
    @Mock private StoreSupplierRepository supplierRepository;

    private StoreSaleService service;
    private StoreFarmer farmer;
    private StoreItem feed;     // ₹1,200 a bag, not a reward item
    private StoreItem mineral;  // ₹150, can be taken for 100 diamonds

    @BeforeEach
    void setUp() {
        StoreRewardService rewards = new StoreRewardService(rewardRepository, settingRepository);
        service = new StoreSaleService(saleRepository, itemRepository, farmerRepository, stockService, ledgerService,
                userRepository, rewards, auditRepository, new ObjectMapper().registerModule(new JavaTimeModule()));

        farmer = new StoreFarmer();
        farmer.setId(7L);
        farmer.setName("Ramesh");
        feed = item(1L, "Cattle feed", "1200", null);
        mineral = item(2L, "Mineral mix", "150", 100);

        when(settingRepository.findById(StoreRewardService.RATE_KEY)).thenReturn(Optional.empty()); // default 10 per ₹1,000
        when(farmerRepository.findById(7L)).thenReturn(Optional.of(farmer));
        when(itemRepository.findById(1L)).thenReturn(Optional.of(feed));
        when(itemRepository.findById(2L)).thenReturn(Optional.of(mineral));
        when(ledgerService.balance(any())).thenReturn(BigDecimal.ZERO);
        when(stockService.consume(any(), any(), any(), any(), any(), any()))
                .thenAnswer(inv -> ((BigDecimal) inv.getArgument(1)).multiply(new BigDecimal("100")));
        when(saleRepository.save(any())).thenAnswer(inv -> {
            StoreSale s = inv.getArgument(0);
            if (s.getId() == null) s.setId(55L);
            return s;
        });
    }

    @AfterEach
    void clearAuth() {
        SecurityContextHolder.clearContext();
    }

    private static StoreItem item(Long id, String name, String price, Integer coins) {
        StoreItem i = new StoreItem();
        i.setId(id);
        i.setName(name);
        i.setSalePrice(new BigDecimal(price));
        i.setRewardCoins(coins);
        return i;
    }

    private static SaleRequest bill(Long farmerId, StorePaymentMode mode, SaleLineRequest... lines) {
        return new SaleRequest(null, farmerId, null, null, BigDecimal.ZERO, mode, null, null, List.of(lines));
    }

    private static SaleLineRequest line(StoreItem item, String qty, boolean redeem) {
        return new SaleLineRequest(item.getId(), new BigDecimal(qty), item.getSalePrice(), redeem);
    }

    private List<StoreRewardEntry> savedRewards() {
        ArgumentCaptor<StoreRewardEntry> c = ArgumentCaptor.forClass(StoreRewardEntry.class);
        verify(rewardRepository, atLeast(0)).save(c.capture());
        return c.getAllValues();
    }

    @Test
    void cashBillForContactEarnsTenDiamondsPerThousandPaid() {
        StoreSale sale = service.create(bill(7L, StorePaymentMode.CASH, line(feed, "2", false))); // ₹2,400

        assertEquals(24, sale.getCoinsEarned());
        List<StoreRewardEntry> entries = savedRewards();
        assertEquals(1, entries.size());
        assertEquals(StoreRewardType.EARN, entries.get(0).getType());
        assertEquals(24, entries.get(0).getCoins());
        assertEquals(55L, entries.get(0).getSaleId());
    }

    @Test
    void creditBillEarnsNothingUntilPaidAndWalkInsNeverEarn() {
        StoreSale credit = service.create(bill(7L, StorePaymentMode.CREDIT, line(feed, "1", false)));
        assertEquals(0, credit.getCoinsEarned());

        StoreSale walkIn = service.create(bill(null, StorePaymentMode.CASH, line(feed, "1", false)));
        assertEquals(0, walkIn.getCoinsEarned());
        assertTrue(savedRewards().isEmpty());
    }

    @Test
    void redeemedLineComesOffTheTotalAndSpendsDiamonds() {
        when(rewardRepository.balance(7L)).thenReturn(250L);

        StoreSale sale = service.create(bill(7L, StorePaymentMode.CASH,
                line(feed, "1", false), line(mineral, "2", true)));

        assertEquals(0, new BigDecimal("1500").compareTo(sale.getSubtotal()));
        assertEquals(0, new BigDecimal("300").compareTo(sale.getRewardValue()));
        assertEquals(0, new BigDecimal("1200").compareTo(sale.getTotal()));
        assertEquals(200, sale.getCoinsRedeemed());
        assertEquals(12, sale.getCoinsEarned()); // on the ₹1,200 actually paid
        List<StoreRewardEntry> entries = savedRewards();
        assertTrue(entries.stream().anyMatch(e -> e.getType() == StoreRewardType.REDEEM && e.getCoins() == -200));
    }

    @Test
    void cannotSpendMoreDiamondsThanTheContactHas() {
        when(rewardRepository.balance(7L)).thenReturn(150L);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> service.create(bill(7L, StorePaymentMode.CASH, line(mineral, "2", true))));
        assertTrue(ex.getMessage().contains("has 150 diamonds"));
    }

    @Test
    void onlyRewardItemsCanBeTakenWithDiamonds() {
        when(rewardRepository.balance(7L)).thenReturn(10_000L);
        assertThrows(IllegalArgumentException.class,
                () -> service.create(bill(7L, StorePaymentMode.CASH, line(feed, "1", true))));
    }

    @Test
    void createAndEditAreLoggedWithWhatChangedAndTheOldBill() {
        StoreSale sale = service.create(bill(7L, StorePaymentMode.CASH, line(feed, "1", false)));
        sale.setBillNo("FS-000055");
        when(saleRepository.findById(55L)).thenReturn(Optional.of(sale));

        User owner = new User();
        owner.setId(1L);
        when(userRepository.findByEmail("owner")).thenReturn(Optional.of(owner));
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("owner", null, List.of()));

        service.update(55L, bill(7L, StorePaymentMode.CASH, line(feed, "2", false), line(mineral, "1", false)));

        ArgumentCaptor<StoreSaleAudit> c = ArgumentCaptor.forClass(StoreSaleAudit.class);
        verify(auditRepository, times(2)).save(c.capture());
        StoreSaleAudit created = c.getAllValues().get(0);
        StoreSaleAudit edited = c.getAllValues().get(1);
        assertEquals("CREATED", created.getAction());
        assertEquals("EDITED", edited.getAction());
        assertEquals("owner", edited.getCreatedBy());
        assertEquals(0, new BigDecimal("1200").compareTo(edited.getTotalBefore()));
        assertEquals(0, new BigDecimal("2550").compareTo(edited.getTotalAfter()));
        assertTrue(edited.getChanges().contains("Cattle feed qty 1 → 2"), edited.getChanges());
        assertTrue(edited.getChanges().contains("Added Mineral mix ×1"), edited.getChanges());
        assertNotNull(edited.getSnapshot());
        assertTrue(edited.getSnapshot().contains("\"total\":1200"), edited.getSnapshot());
        verify(rewardRepository).deleteBySaleId(55L); // old diamonds dropped before redoing them
    }

    @Test
    void contactPhoneIsOptionalButMustBeTenDigitsWhenGiven() {
        StoreMasterService master = new StoreMasterService(itemRepository, supplierRepository, farmerRepository);
        when(farmerRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        StoreFarmer noPhone = new StoreFarmer();
        noPhone.setName("Walk-in regular");
        noPhone.setPhone("  ");
        assertNull(master.saveFarmer(null, noPhone).getPhone());

        StoreFarmer shortPhone = new StoreFarmer();
        shortPhone.setName("Suresh");
        shortPhone.setPhone("98450123");
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> master.saveFarmer(null, shortPhone));
        assertEquals(StoreMasterService.PHONE_MESSAGE, ex.getMessage());
    }
}
