package com.dairy.service;

import com.dairy.model.Customer;
import com.dairy.model.CustomerPriceSlab;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class CustomerPricingServiceTest {

    private static Customer customer(double defaultRate) {
        Customer c = new Customer();
        c.setId(1L);
        c.setDefaultRate(defaultRate);
        return c;
    }

    // The sheet: below 10 L ₹46, 10-15 L ₹47 + ₹10 delivery, above 15 L ₹48 + ₹8, above 20 L ₹48 + ₹7.
    private static final List<CustomerPriceSlab> SLABS = List.of(
        new CustomerPriceSlab(1L, 20.0, 48.0, 7.0),
        new CustomerPriceSlab(1L, 0.0, 46.0, 0.0),
        new CustomerPriceSlab(1L, 15.0, 48.0, 8.0),
        new CustomerPriceSlab(1L, 10.0, 47.0, 10.0));

    @Test
    void picksTheSlabForTheVolume() {
        Customer c = customer(45);
        assertEquals(46, CustomerPricingService.quote(c, SLABS, 4).rate());
        assertEquals(57, CustomerPricingService.quote(c, SLABS, 10).rate());
        assertEquals(57, CustomerPricingService.quote(c, SLABS, 12.5).rate());
        assertEquals(56, CustomerPricingService.quote(c, SLABS, 18).rate());
        assertEquals(55, CustomerPricingService.quote(c, SLABS, 25).rate());

        CustomerPricingService.Quote q = CustomerPricingService.quote(c, SLABS, 12);
        assertEquals(47, q.milkRate());
        assertEquals(10, q.deliveryRate());
    }

    @Test
    void noDeliveryAtAVolumeMeansMilkPriceOnly() {
        CustomerPriceSlab pickup = new CustomerPriceSlab(1L, 0.0, 46.0, 5.0);
        pickup.setDeliveryAvailable(false);
        List<CustomerPriceSlab> slabs = List.of(pickup, new CustomerPriceSlab(1L, 10.0, 47.0, 10.0));
        CustomerPricingService.Quote q = CustomerPricingService.quote(customer(45), slabs, 6);
        assertEquals(46, q.rate());
        assertEquals(0, q.deliveryRate());
        assertEquals(57, CustomerPricingService.quote(customer(45), slabs, 10).rate());
    }

    @Test
    void belowTheFirstSlabUsesTheFirstSlab() {
        List<CustomerPriceSlab> fromFive = List.of(new CustomerPriceSlab(1L, 5.0, 50.0, 2.0));
        assertEquals(52, CustomerPricingService.quote(customer(45), fromFive, 2).rate());
    }

    @Test
    void noSlabsFallsBackToTheDefaultRate() {
        CustomerPricingService.Quote q = CustomerPricingService.quote(customer(44), List.of(), 30);
        assertEquals(44, q.rate());
        assertEquals(0, q.deliveryRate());
    }
}
