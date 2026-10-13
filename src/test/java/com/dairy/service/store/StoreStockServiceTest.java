package com.dairy.service.store;

import com.dairy.model.store.StoreItem;
import com.dairy.model.store.StoreMoveType;
import com.dairy.model.store.StoreStockBatch;
import com.dairy.model.store.StoreStockMove;
import com.dairy.repo.store.StoreItemRepository;
import com.dairy.repo.store.StoreStockBatchRepository;
import com.dairy.repo.store.StoreStockMoveRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class StoreStockServiceTest {

    private StoreStockBatchRepository batchRepository;
    private StoreStockMoveRepository moveRepository;
    private StoreStockService service;
    private StoreItem feed;

    @BeforeEach
    void setUp() {
        batchRepository = mock(StoreStockBatchRepository.class);
        moveRepository = mock(StoreStockMoveRepository.class);
        service = new StoreStockService(batchRepository, moveRepository, mock(StoreItemRepository.class));
        feed = new StoreItem();
        feed.setId(1L);
        feed.setName("Cattle Feed 50kg");
    }

    private StoreStockBatch batch(long id, String qty, String cost) {
        StoreStockBatch b = new StoreStockBatch();
        b.setId(id);
        b.setItem(feed);
        b.setQtyReceived(new BigDecimal(qty));
        b.setQtyRemaining(new BigDecimal(qty));
        b.setUnitCost(new BigDecimal(cost));
        b.setReceivedDate(LocalDate.of(2026, 10, 1));
        return b;
    }

    @Test
    void consumeTakesOldestBatchFirstAndReturnsBlendedCost() {
        StoreStockBatch older = batch(1, "3", "1400");
        StoreStockBatch newer = batch(2, "10", "1450");
        when(batchRepository.lockAvailableFifo(1L)).thenReturn(List.of(older, newer));

        BigDecimal cost = service.consume(feed, new BigDecimal("5"), StoreMoveType.SALE, "SALE", 9L, null);

        // 3 x 1400 + 2 x 1450
        assertEquals(0, cost.compareTo(new BigDecimal("7100")));
        assertEquals(0, older.getQtyRemaining().signum());
        assertEquals(0, newer.getQtyRemaining().compareTo(new BigDecimal("8")));

        ArgumentCaptor<StoreStockMove> moves = ArgumentCaptor.forClass(StoreStockMove.class);
        verify(moveRepository, times(2)).save(moves.capture());
        assertEquals(0, moves.getAllValues().get(0).getQty().compareTo(new BigDecimal("-3")));
        assertEquals(0, moves.getAllValues().get(1).getQty().compareTo(new BigDecimal("-2")));
    }

    @Test
    void consumeRejectsMoreThanAvailableWithoutTouchingStock() {
        StoreStockBatch only = batch(1, "2", "1400");
        when(batchRepository.lockAvailableFifo(1L)).thenReturn(List.of(only));

        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> service.consume(feed, new BigDecimal("3"), StoreMoveType.SALE, "SALE", 9L, null));

        assertTrue(ex.getMessage().contains("available 2"));
        assertEquals(0, only.getQtyRemaining().compareTo(new BigDecimal("2")));
        verifyNoInteractions(moveRepository);
    }

    @Test
    void receiveDefaultsExpiryFromShelfLife() {
        feed.setShelfLifeDays(90);
        when(batchRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        StoreStockBatch b = service.receive(feed, new BigDecimal("10"), new BigDecimal("1400"), null, null,
                LocalDate.of(2026, 10, 1), null, StoreMoveType.PURCHASE, "PURCHASE", 1L, null);

        assertEquals(LocalDate.of(2026, 12, 30), b.getExpiryDate());
        assertEquals(0, b.getQtyRemaining().compareTo(new BigDecimal("10")));
    }

    @Test
    void phoneNumbersAreNormalisedToLastTenDigits() {
        assertEquals("9845012345", StoreMasterService.normalisePhone("+91 98450 12345"));
        assertEquals("9845012345", StoreMasterService.normalisePhone("9845012345"));
        assertNull(StoreMasterService.normalisePhone("12345"));
    }
}
