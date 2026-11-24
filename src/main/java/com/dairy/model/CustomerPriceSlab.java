package com.dairy.model;

import jakarta.persistence.*;

/**
 * One volume band of a customer's milk price. A delivery of Q litres uses the slab with the
 * highest fromLitres that is ≤ Q; the price per litre is milkRate + deliveryRate.
 *
 * e.g. from 0 L: ₹46, no delivery; from 10 L: ₹47 + ₹10, from 15 L: ₹48 + ₹8, from 20 L: ₹48 + ₹7.
 */
@Entity
@Table(name = "customer_price_slabs")
public class CustomerPriceSlab {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "customer_id", nullable = false)
    private Long customerId;

    /** The slab applies to deliveries of this many litres or more. */
    @Column(name = "from_litres", nullable = false)
    private Double fromLitres = 0.0;

    /** Milk price per litre. */
    @Column(name = "milk_rate", nullable = false)
    private Double milkRate;

    /** Delivery charge per litre, on top of the milk price. */
    @Column(name = "delivery_rate", nullable = false)
    private Double deliveryRate = 0.0;

    /** False when the farm doesn't deliver at this volume (the customer collects); null on older rows = delivers. */
    @Column(name = "delivery_available")
    private Boolean deliveryAvailable = Boolean.TRUE;

    public CustomerPriceSlab() {}

    public CustomerPriceSlab(Long customerId, Double fromLitres, Double milkRate, Double deliveryRate) {
        this.customerId = customerId;
        this.fromLitres = fromLitres;
        this.milkRate = milkRate;
        this.deliveryRate = deliveryRate;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getCustomerId() { return customerId; }
    public void setCustomerId(Long customerId) { this.customerId = customerId; }

    public Double getFromLitres() { return fromLitres; }
    public void setFromLitres(Double fromLitres) { this.fromLitres = fromLitres; }

    public Double getMilkRate() { return milkRate; }
    public void setMilkRate(Double milkRate) { this.milkRate = milkRate; }

    public Double getDeliveryRate() { return deliveryRate; }
    public void setDeliveryRate(Double deliveryRate) { this.deliveryRate = deliveryRate; }

    public Boolean getDeliveryAvailable() { return !Boolean.FALSE.equals(deliveryAvailable); }
    public void setDeliveryAvailable(Boolean deliveryAvailable) { this.deliveryAvailable = deliveryAvailable; }
}
