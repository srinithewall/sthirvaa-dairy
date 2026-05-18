package com.dairy.dto;

import java.util.List;

public class CheckoutRequestDTO {
    private List<CheckoutItemDTO> items;
    private String deliveryAddress;
    private String paymentMethod;
    private Double subtotal;
    private Double discount;
    private Double gatewayFee;
    private Double total;

    public CheckoutRequestDTO() {}

    public List<CheckoutItemDTO> getItems() { return items; }
    public void setItems(List<CheckoutItemDTO> items) { this.items = items; }

    public String getDeliveryAddress() { return deliveryAddress; }
    public void setDeliveryAddress(String deliveryAddress) { this.deliveryAddress = deliveryAddress; }

    public String getPaymentMethod() { return paymentMethod; }
    public void setPaymentMethod(String paymentMethod) { this.paymentMethod = paymentMethod; }

    public Double getSubtotal() { return subtotal; }
    public void setSubtotal(Double subtotal) { this.subtotal = subtotal; }

    public Double getDiscount() { return discount; }
    public void setDiscount(Double discount) { this.discount = discount; }

    public Double getGatewayFee() { return gatewayFee; }
    public void setGatewayFee(Double gatewayFee) { this.gatewayFee = gatewayFee; }

    public Double getTotal() { return total; }
    public void setTotal(Double total) { this.total = total; }

    public static class CheckoutItemDTO {
        private Long productId;
        private Integer quantity;
        private Double price;

        public CheckoutItemDTO() {}

        public Long getProductId() { return productId; }
        public void setProductId(Long productId) { this.productId = productId; }

        public Integer getQuantity() { return quantity; }
        public void setQuantity(Integer quantity) { this.quantity = quantity; }

        public Double getPrice() { return price; }
        public void setPrice(Double price) { this.price = price; }
    }
}
