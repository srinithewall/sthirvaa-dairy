package com.dairy.dto;

import java.time.LocalDateTime;
import java.util.List;

public class OrderResponseDTO {
    private String id;
    private String invoiceDate;
    private String dueDate;
    private Double total;
    private String status;
    private String paymentStatus;
    private Double subtotal;
    private Double discount;
    private Double gatewayFee;
    private CustomerDTO customer;
    private List<OrderItemDTO> items;

    public OrderResponseDTO() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getInvoiceDate() { return invoiceDate; }
    public void setInvoiceDate(String invoiceDate) { this.invoiceDate = invoiceDate; }

    public String getDueDate() { return dueDate; }
    public void setDueDate(String dueDate) { this.dueDate = dueDate; }

    public Double getTotal() { return total; }
    public void setTotal(Double total) { this.total = total; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getPaymentStatus() { return paymentStatus; }
    public void setPaymentStatus(String paymentStatus) { this.paymentStatus = paymentStatus; }

    public Double getSubtotal() { return subtotal; }
    public void setSubtotal(Double subtotal) { this.subtotal = subtotal; }

    public Double getDiscount() { return discount; }
    public void setDiscount(Double discount) { this.discount = discount; }

    public Double getGatewayFee() { return gatewayFee; }
    public void setGatewayFee(Double gatewayFee) { this.gatewayFee = gatewayFee; }

    public CustomerDTO getCustomer() { return customer; }
    public void setCustomer(CustomerDTO customer) { this.customer = customer; }

    public List<OrderItemDTO> getItems() { return items; }
    public void setItems(List<OrderItemDTO> items) { this.items = items; }

    public static class CustomerDTO {
        private String name;
        private String email;
        private String phone;
        private String address;

        public CustomerDTO() {}

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }

        public String getEmail() { return email; }
        public void setEmail(String email) { this.email = email; }

        public String getPhone() { return phone; }
        public void setPhone(String phone) { this.phone = phone; }

        public String getAddress() { return address; }
        public void setAddress(String address) { this.address = address; }
    }

    public static class OrderItemDTO {
        private String name;
        private String description;
        private Integer qty;
        private Double price;
        private Double amount;

        public OrderItemDTO() {}

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }

        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }

        public Integer getQty() { return qty; }
        public void setQty(Integer qty) { this.qty = qty; }

        public Double getPrice() { return price; }
        public void setPrice(Double price) { this.price = price; }

        public Double getAmount() { return amount; }
        public void setAmount(Double amount) { this.amount = amount; }
    }
}
