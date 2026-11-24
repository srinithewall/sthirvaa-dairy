package com.dairy.service;

import com.dairy.model.Customer;
import com.dairy.model.MilkDispatch;
import com.dairy.repo.MilkDispatchRepository;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class CustomerPortalServiceTest {

    private static MilkDispatch dispatch(String date, String shift, double litres, double rate, Double delivery) {
        MilkDispatch d = new MilkDispatch();
        d.setDate(LocalDate.parse(date));
        d.setShift(shift);
        d.setQuantity(litres);
        d.setRatePerLitre(rate);
        d.setDeliveryRate(delivery);
        d.setTotalAmount(litres * rate);
        return d;
    }

    @Test
    void aCustomerWithMilkOnRecordCannotBeDeleted() {
        CustomerPortalService service = new CustomerPortalService();
        com.dairy.repo.CustomerRepository customers = mock(com.dairy.repo.CustomerRepository.class);
        MilkDispatchRepository dispatches = mock(MilkDispatchRepository.class);
        com.dairy.repo.SaleRepository sales = mock(com.dairy.repo.SaleRepository.class);
        com.dairy.repo.CustomerSubscriptionRepository subs = mock(com.dairy.repo.CustomerSubscriptionRepository.class);
        com.dairy.repo.CustomerPriceSlabRepository slabs = mock(com.dairy.repo.CustomerPriceSlabRepository.class);
        com.dairy.repo.UserRepository users = mock(com.dairy.repo.UserRepository.class);
        ReflectionTestUtils.setField(service, "customerRepository", customers);
        ReflectionTestUtils.setField(service, "dispatchRepository", dispatches);
        ReflectionTestUtils.setField(service, "saleRepository", sales);
        ReflectionTestUtils.setField(service, "subscriptionRepository", subs);
        ReflectionTestUtils.setField(service, "slabRepository", slabs);
        ReflectionTestUtils.setField(service, "userRepository", users);

        Customer c = new Customer();
        c.setId(1L);
        c.setName("Society");
        when(customers.findById(1L)).thenReturn(java.util.Optional.of(c));
        when(dispatches.existsByCustomer_Id(1L)).thenReturn(true);
        org.junit.jupiter.api.Assertions.assertThrows(IllegalArgumentException.class, () -> service.deleteCustomer(1L));
        verify(customers, never()).delete(any());
        verify(slabs, never()).deleteByCustomerId(any());
        verifyNoInteractions(users);

        // No milk, sales or subscription: the customer, prices and login go.
        when(dispatches.existsByCustomer_Id(1L)).thenReturn(false);
        when(users.findFirstByCustomerIdAndRole(eq(1L), any())).thenReturn(java.util.Optional.empty());
        service.deleteCustomer(1L);
        verify(slabs).deleteByCustomerId(1L);
        verify(customers).delete(c);
    }

    @Test
    @SuppressWarnings("unchecked")
    void statementGroupsDeliveriesByDayNewestFirst() {
        CustomerPortalService service = new CustomerPortalService();
        MilkDispatchRepository dispatches = mock(MilkDispatchRepository.class);
        CustomerPricingService pricing = mock(CustomerPricingService.class);
        when(pricing.slabs(any())).thenReturn(List.of());
        ReflectionTestUtils.setField(service, "dispatchRepository", dispatches);
        ReflectionTestUtils.setField(service, "pricingService", pricing);

        Customer c = new Customer();
        c.setId(7L);
        c.setName("Hotel");
        c.setDefaultRate(45.0);
        when(dispatches.findByCustomer_IdAndDispatchTypeAndDateBetweenOrderByDateAscShiftDesc(eq(7L), eq("CUSTOMER"), any(), any()))
            .thenReturn(List.of(
                dispatch("2026-11-01", "MORNING", 12, 57, 10.0),
                dispatch("2026-11-01", "EVENING", 8, 46, 0.0),
                dispatch("2026-11-02", "MORNING", 22, 55, 7.0),
                dispatch("2026-11-03", "COMBINED", 5, 40, null)));

        Map<String, Object> out = service.statement(c, LocalDate.parse("2026-11-01"), LocalDate.parse("2026-11-30"));

        assertEquals(47.0, (double) out.get("totalLitres"), 1e-9);
        assertEquals(12 * 57 + 8 * 46 + 22 * 55 + 5 * 40, (double) out.get("totalAmount"), 1e-9);
        assertEquals(12 * 10 + 22 * 7, (double) out.get("totalDelivery"), 1e-9);
        assertEquals(3, out.get("deliveryDays"));

        List<Map<String, Object>> days = (List<Map<String, Object>>) out.get("days");
        assertEquals("2026-11-03", days.get(0).get("date"));
        Map<String, Object> first = days.get(2);
        assertEquals("2026-11-01", first.get("date"));
        assertEquals(12.0, first.get("morning"));
        assertEquals(8.0, first.get("evening"));
        assertEquals(20.0, first.get("litres"));
        assertEquals(12 * 57 + 8 * 46.0, first.get("amount"));
        assertEquals(2, ((List<?>) first.get("deliveries")).size());
        // A combined (whole-day) delivery is in the total, not under morning or evening.
        assertEquals(0.0, days.get(0).get("morning"));
        assertEquals(0.0, days.get(0).get("evening"));
        assertEquals(5.0, days.get(0).get("litres"));
    }
}
