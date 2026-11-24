package com.dairy.service;

import com.dairy.model.Customer;
import com.dairy.model.MilkDispatch;
import com.dairy.model.Sale;
import com.dairy.repo.CustomerRepository;
import com.dairy.repo.IncomeRepository;
import com.dairy.repo.MilkDispatchRepository;
import com.dairy.repo.SaleRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MilkDispatchSessionSalesTest {

    @Mock private MilkDispatchRepository dispatchRepository;
    @Mock private CustomerRepository customerRepository;
    @Mock private IncomeRepository incomeRepository;
    @Mock private SaleRepository saleRepository;
    @Mock private CustomerPricingService pricingService;
    @InjectMocks private MilkDispatchService service;

    private static final LocalDate DAY = LocalDate.of(2026, 11, 23);

    private static Customer customer(long id) {
        Customer c = new Customer();
        c.setId(id);
        return c;
    }

    private static Sale sale(long id, Customer c, String status) {
        Sale s = new Sale();
        s.setId(id);
        s.setCustomer(c);
        s.setDate(DAY);
        s.setItemName("Milk (EVENING)");
        s.setQuantity(10.0);
        s.setPaymentStatus(status);
        return s;
    }

    private static Map<String, Object> row(long customerId, double litres) {
        return Map.of("date", DAY.toString(), "shift", "EVENING", "dispatchType", "CUSTOMER",
                "customerId", customerId, "quantity", litres, "ratePerLitre", 50);
    }

    @Test
    void savingADayAgainUpdatesItsSalesInsteadOfAddingMore() {
        Customer society = customer(1);
        Customer test = customer(6);
        Sale paid = sale(100, society, "PAID");
        Sale stale = sale(101, customer(9), "PENDING");   // customer no longer in this session
        when(customerRepository.findById(1L)).thenReturn(Optional.of(society));
        when(customerRepository.findById(6L)).thenReturn(Optional.of(test));
        when(pricingService.quote(anyLong(), anyDouble())).thenReturn(new CustomerPricingService.Quote(47, 13, 60));
        when(saleRepository.findByDateAndItemNameOrderByIdAsc(DAY, "Milk (EVENING)")).thenReturn(new ArrayList<>(List.of(paid, stale)));
        when(dispatchRepository.save(any(MilkDispatch.class))).thenAnswer(i -> i.getArgument(0));
        when(incomeRepository.findByCategoryAndDate(any(), any())).thenReturn(Optional.empty());

        service.saveSession(List.of(row(1, 26.5), row(6, 11)));

        ArgumentCaptor<Sale> saved = ArgumentCaptor.forClass(Sale.class);
        verify(saleRepository, times(2)).save(saved.capture());
        // The society's sale is the same record, updated, still paid.
        Sale updated = saved.getAllValues().get(0);
        assertThat(updated).isSameAs(paid);
        assertThat(updated.getQuantity()).isEqualTo(26.5);
        assertThat(updated.getPaymentStatus()).isEqualTo("PAID");
        // The new customer gets a new pending sale.
        Sale added = saved.getAllValues().get(1);
        assertThat(added.getId()).isNull();
        assertThat(added.getCustomer()).isSameAs(test);
        assertThat(added.getPaymentStatus()).isEqualTo("PENDING");
        // The delivery that left the session takes its pending sale with it.
        verify(saleRepository).delete(stale);
    }

    @Test
    void aPaidSaleIsNeverDeletedWhenItsDeliveryIsRemoved() {
        Customer society = customer(1);
        Sale paid = sale(100, customer(9), "PAID");
        when(customerRepository.findById(1L)).thenReturn(Optional.of(society));
        when(pricingService.quote(anyLong(), anyDouble())).thenReturn(new CustomerPricingService.Quote(50, 0, 50));
        when(saleRepository.findByDateAndItemNameOrderByIdAsc(DAY, "Milk (EVENING)")).thenReturn(new ArrayList<>(List.of(paid)));
        when(dispatchRepository.save(any(MilkDispatch.class))).thenAnswer(i -> i.getArgument(0));
        when(incomeRepository.findByCategoryAndDate(any(), any())).thenReturn(Optional.empty());

        service.saveSession(List.of(row(1, 20)));

        verify(saleRepository, never()).delete(any(Sale.class));
    }
}
