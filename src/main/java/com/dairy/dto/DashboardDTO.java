package com.dairy.dto;

import java.util.List;
import java.util.Map;

public class DashboardDTO {
    private Double todayMilkProduction;
    private Double yesterdayMilkProduction;
    private Double monthMilkProduction;
    private Double totalMilkProduction;
    
    private Double todayRevenue;
    private Double yesterdayRevenue;
    private Double monthRevenue;
    private Double totalRevenue;
    
    private Double todayExpense;
    private Double yesterdayExpense;
    private Double monthExpense;
    private Double totalExpense;
    
    private Double todayProfit;
    private Double currentMonthProfit;
    private Double totalProfit;
    
    private Map<String, Double> productionChartData;
    private Map<String, Double> revenueChartData;
    private Map<String, Double> expenseChartData;
    private Map<String, Double> expensePieChartData;
    
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

    public Double getMonthMilkProduction() { return monthMilkProduction; }
    public void setMonthMilkProduction(Double monthMilkProduction) { this.monthMilkProduction = monthMilkProduction; }

    public Double getTotalMilkProduction() { return totalMilkProduction; }
    public void setTotalMilkProduction(Double totalMilkProduction) { this.totalMilkProduction = totalMilkProduction; }

    public Double getMonthRevenue() { return monthRevenue; }
    public void setMonthRevenue(Double monthRevenue) { this.monthRevenue = monthRevenue; }

    public Double getTotalRevenue() { return totalRevenue; }
    public void setTotalRevenue(Double totalRevenue) { this.totalRevenue = totalRevenue; }

    public Double getMonthExpense() { return monthExpense; }
    public void setMonthExpense(Double monthExpense) { this.monthExpense = monthExpense; }

    public Double getTotalExpense() { return totalExpense; }
    public void setTotalExpense(Double totalExpense) { this.totalExpense = totalExpense; }

    public Double getTodayProfit() { return todayProfit; }
    public void setTodayProfit(Double todayProfit) { this.todayProfit = todayProfit; }

    public Double getTotalProfit() { return totalProfit; }
    public void setTotalProfit(Double totalProfit) { this.totalProfit = totalProfit; }

    public Map<String, Double> getExpensePieChartData() { return expensePieChartData; }
    public void setExpensePieChartData(Map<String, Double> expensePieChartData) { this.expensePieChartData = expensePieChartData; }
}
