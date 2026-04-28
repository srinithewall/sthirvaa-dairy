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

    @Transactional(readOnly = true)
    public List<MilkRecord> getByDate(LocalDate date) {
        List<MilkRecord> records = milkRecordRepository.findByDate(date);
        // Touch herd to force-load within transaction
        records.forEach(r -> { if (r.getHerd() != null) r.getHerd().getId(); });
        return records;
    }

    public List<MilkRecord> getByHerd(Long herdId) {
        return milkRecordRepository.findByHerdId(herdId);
    }

    @Transactional
    public List<MilkRecord> saveBatch(List<Map<String, Object>> entries) {
        if (entries.isEmpty()) return List.of();

        // Group by date and shift to clear old records first
        Set<String> dateShifts = new HashSet<>();
        for (Map<String, Object> e : entries) {
            dateShifts.add(e.get("date").toString() + "|" + e.get("shift").toString());
        }

        for (String ds : dateShifts) {
            String[] parts = ds.split("\\|");
            milkRecordRepository.deleteByDateAndShift(LocalDate.parse(parts[0]), parts[1]);
        }

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
                .filter(r -> r.getHerd() != null)
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
