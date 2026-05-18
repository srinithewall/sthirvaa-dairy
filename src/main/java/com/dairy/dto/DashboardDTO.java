package com.dairy.dto;

import java.util.List;
import java.util.Map;

public class DashboardDTO {
    private Double todayMilkProduction;
    private Double yesterdayMilkProduction;
    private Double todayRevenue;
    private Double yesterdayRevenue;
    private Double todayExpense;
    private Double yesterdayExpense;
    private Double currentMonthProfit;
    
    private Map<String, Double> productionChartData;
    private Map<String, Double> revenueChartData;
    private Map<String, Double> expenseChartData;
    
    private List<TopMilkerDTO> topMilkers;

    // Getters and Setters
    public Double getTodayMilkProduction() { return todayMilkProduction; }
    public void setTodayMilkProduction(Double todayMilkProduction) { this.todayMilkProduction = todayMilkProduction; }

    public Double getYesterdayMilkProduction() { return yesterdayMilkProduction; }
    public void setYesterdayMilkProduction(Double yesterdayMilkProduction) { this.yesterdayMilkProduction = yesterdayMilkProduction; }

    public Double getTodayRevenue() { return todayRevenue; }
    public void setTodayRevenue(Double todayRevenue) { this.todayRevenue = todayRevenue; }

    public Double getYesterdayRevenue() { return yesterdayRevenue; }
    public void setYesterdayRevenue(Double yesterdayRevenue) { this.yesterdayRevenue = yesterdayRevenue; }

    public Double getTodayExpense() { return todayExpense; }
    public void setTodayExpense(Double todayExpense) { this.todayExpense = todayExpense; }

    public Double getYesterdayExpense() { return yesterdayExpense; }
    public void setYesterdayExpense(Double yesterdayExpense) { this.yesterdayExpense = yesterdayExpense; }

    public Double getCurrentMonthProfit() { return currentMonthProfit; }
    public void setCurrentMonthProfit(Double currentMonthProfit) { this.currentMonthProfit = currentMonthProfit; }

    public Map<String, Double> getProductionChartData() { return productionChartData; }
    public void setProductionChartData(Map<String, Double> productionChartData) { this.productionChartData = productionChartData; }

    public Map<String, Double> getRevenueChartData() { return revenueChartData; }
    public void setRevenueChartData(Map<String, Double> revenueChartData) { this.revenueChartData = revenueChartData; }

    public Map<String, Double> getExpenseChartData() { return expenseChartData; }
    public void setExpenseChartData(Map<String, Double> expenseChartData) { this.expenseChartData = expenseChartData; }

    public List<TopMilkerDTO> getTopMilkers() { return topMilkers; }
    public void setTopMilkers(List<TopMilkerDTO> topMilkers) { this.topMilkers = topMilkers; }
    
    public static class TopMilkerDTO {
        private String cowId;
        private String cowName;
        private Double morningYield;
        private Double eveningYield;
        private Double totalYield;

        public TopMilkerDTO(String cowId, String cowName, Double morningYield, Double eveningYield, Double totalYield) {
            this.cowId = cowId;
            this.cowName = cowName;
            this.morningYield = morningYield;
            this.eveningYield = eveningYield;
            this.totalYield = totalYield;
        }

        public String getCowId() { return cowId; }
        public String getCowName() { return cowName; }
        public Double getMorningYield() { return morningYield; }
        public Double getEveningYield() { return eveningYield; }
        public Double getTotalYield() { return totalYield; }
    }
}
