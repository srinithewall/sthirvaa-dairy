package com.dairy.service;

import com.dairy.model.Herd;
import com.dairy.model.MilkRecord;
import com.dairy.repo.HerdRepository;
import com.dairy.repo.MilkRecordRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class AlertService {
    @Autowired
    private HerdRepository herdRepository;

    @Autowired
    private MilkRecordRepository milkRecordRepository;

    public List<String> getAlerts() {
        List<String> alerts = new ArrayList<>();

        // 1. Low milk production alerts
        List<MilkRecord> todayRecords = milkRecordRepository.findByDate(LocalDate.now());
        // Simple logic: if an animal yields < 2L today, alert
        todayRecords.stream()
                .filter(r -> r.getQuantity() < 2.0)
                .forEach(r -> alerts.add("LOW PRODUCTION: " + r.getHerd().getAnimalType() + " " + r.getHerd().getTagNumber() + " yielded only " + r.getQuantity() + "L today."));

        // 2. Health issues alerts
        List<Herd> sickAnimals = herdRepository.findAll().stream()
                .filter(c -> c.getHealthStatus() != null && (c.getHealthStatus().equalsIgnoreCase("Sick") || c.getHealthStatus().equalsIgnoreCase("Critical")))
                .collect(Collectors.toList());
        sickAnimals.forEach(c -> alerts.add("HEALTH ALERT: " + c.getAnimalType() + " " + c.getTagNumber() + " status is " + c.getHealthStatus() + "."));

        return alerts;
    }
}
