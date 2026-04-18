package com.dairy.service;

import com.dairy.model.Herd;
import com.dairy.model.Income;
import com.dairy.model.MilkRecord;
import com.dairy.repo.HerdRepository;
import com.dairy.repo.IncomeRepository;
import com.dairy.repo.MilkRecordRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class MilkRecordService {

    @Autowired
    private MilkRecordRepository milkRecordRepository;

    @Autowired
    private HerdRepository herdRepository;

    @Autowired
    private IncomeRepository incomeRepository;

    public List<MilkRecord> getAll() {
        return milkRecordRepository.findAll();
    }

    public List<MilkRecord> getByDate(LocalDate date) {
        return milkRecordRepository.findByDate(date);
    }

    public List<MilkRecord> getByHerd(Long herdId) {
        return milkRecordRepository.findByHerdId(herdId);
    }

    @Transactional
    public List<MilkRecord> saveBatch(List<Map<String, Object>> entries) {
        List<MilkRecord> records = entries.stream()
            .filter(e -> e.get("quantity") != null && Double.parseDouble(e.get("quantity").toString()) > 0)
            .map(e -> {
                MilkRecord r = new MilkRecord();
                Long herdId = Long.parseLong(e.get("herdId").toString());
                Herd herd = herdRepository.findById(herdId)
                    .orElseThrow(() -> new RuntimeException("Herd not found: " + herdId));
                r.setHerd(herd);
                r.setDate(LocalDate.parse(e.get("date").toString()));
                r.setShift(e.get("shift").toString());
                r.setQuantity(Double.parseDouble(e.get("quantity").toString()));
                return r;
            })
            .collect(Collectors.toList());

        List<MilkRecord> saved = milkRecordRepository.saveAll(records);

        // Record income automatically
        if (!saved.isEmpty()) {
            double totalYield = saved.stream().mapToDouble(MilkRecord::getQuantity).sum();
            LocalDate date = saved.get(0).getDate();

            Income milkIncome = new Income();
            milkIncome.setCategory("MILK_PRODUCTION");
            milkIncome.setAmount(totalYield * 45.0); // Assuming 45 per liter
            milkIncome.setDate(date);
            milkIncome.setDescription(String.format("Automatic income from %.1f L of milk produced", totalYield));
            incomeRepository.save(milkIncome);
        }

        return saved;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getDailySummary() {
        List<MilkRecord> all = milkRecordRepository.findAllByOrderByDateDesc();

        // Group by date
        Map<LocalDate, List<MilkRecord>> byDate = all.stream()
            .collect(Collectors.groupingBy(MilkRecord::getDate, LinkedHashMap::new, Collectors.toList()));

        List<Map<String, Object>> summary = new ArrayList<>();
        
        for (Map.Entry<LocalDate, List<MilkRecord>> entry : byDate.entrySet()) {
            LocalDate date = entry.getKey();
            List<MilkRecord> dayRecords = entry.getValue();

            double morning = dayRecords.stream()
                .filter(r -> "MORNING".equalsIgnoreCase(r.getShift()))
                .mapToDouble(MilkRecord::getQuantity).sum();

            double evening = dayRecords.stream()
                .filter(r -> "EVENING".equalsIgnoreCase(r.getShift()))
                .mapToDouble(MilkRecord::getQuantity).sum();

            long cowCount = dayRecords.stream()
                .map(r -> r.getHerd().getId())
                .distinct()
                .count();

            Map<String, Object> dayMap = new HashMap<>();
            dayMap.put("date", date.toString());
            dayMap.put("morning", morning);
            dayMap.put("evening", evening);
            dayMap.put("total", morning + evening);
            dayMap.put("cowCount", cowCount);
            
            summary.add(dayMap);
        }

        return summary;
    }
}
