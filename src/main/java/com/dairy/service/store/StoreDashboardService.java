package com.dairy.service.store;

import com.dairy.dto.store.StoreDtos.Dashboard;
import com.dairy.dto.store.StoreDtos.StockRow;
import com.dairy.model.store.StorePaymentMode;
import com.dairy.model.store.StoreSale;
import com.dairy.model.store.StoreSaleType;
import com.dairy.repo.store.StoreSaleRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

@Service
public class StoreDashboardService {

    private final StoreSaleRepository saleRepository;
    private final StoreStockService stockService;

    public StoreDashboardService(StoreSaleRepository saleRepository, StoreStockService stockService) {
        this.saleRepository = saleRepository;
        this.stockService = stockService;
    }

    @Transactional(readOnly = true)
    public Dashboard dashboard(LocalDate date) {
        List<StoreSale> today = saleRepository.findBySaleDateBetweenAndTypeOrderBySaleDateDescIdDesc(
                date, date, StoreSaleType.CUSTOMER);
        List<StoreSale> month = saleRepository.findBySaleDateBetweenAndTypeOrderBySaleDateDescIdDesc(
                date.withDayOfMonth(1), date, StoreSaleType.CUSTOMER);

        Map<StorePaymentMode, BigDecimal> byMode = new EnumMap<>(StorePaymentMode.class);
        for (StoreSale s : today) {
            byMode.merge(s.getPaymentMode(), s.getTotal(), BigDecimal::add);
        }
        List<StockRow> stock = stockService.stock(false);
        BigDecimal stockValue = stock.stream().map(StockRow::stockValue).reduce(BigDecimal.ZERO, BigDecimal::add);

        return new Dashboard(date, today.size(), sum(today, true), margin(today), byMode,
                sum(month, true), margin(month), stockValue,
                stock.stream().filter(StockRow::lowStock).toList(), stockService.expiring(30));
    }

    private static BigDecimal sum(List<StoreSale> sales, boolean total) {
        return sales.stream().map(total ? StoreSale::getTotal : StoreSale::getCostTotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private static BigDecimal margin(List<StoreSale> sales) {
        return sum(sales, true).subtract(sum(sales, false));
    }
}
