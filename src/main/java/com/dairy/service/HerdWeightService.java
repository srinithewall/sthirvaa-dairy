package com.dairy.service;

import com.dairy.dto.WeightRoundResult;
import com.dairy.dto.WeightRoundRow;
import com.dairy.model.ActivityStatus;
import com.dairy.model.FarmActivityLog;
import com.dairy.model.User;
import com.dairy.repo.UserRepository;
import com.dairy.model.HerdWeightRecord;
import com.dairy.model.Herd;
import com.dairy.repo.HerdWeightRecordRepository;
import com.dairy.repo.HerdRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
public class HerdWeightService {

    private static final Logger logger = LoggerFactory.getLogger(HerdWeightService.class);

    @Autowired
    private HerdWeightRecordRepository weightRepo;

    @Autowired
    private HerdRepository herdRepo;

    @Autowired
    private HerdService herdService;

    @Autowired
    private FarmActivityService activityService;

    @Autowired
    private UserRepository userRepository;

    public List<HerdWeightRecord> getWeightHistory(Long herdId) {
        return weightRepo.findByHerdIdOrderByRecordDateDesc(herdId);
    }

    public HerdWeightRecord addWeightRecord(HerdWeightRecord record) {
        if (record.getWeightKg() == null) {
            Herd herd = herdRepo.findById(record.getHerdId()).orElse(null);
            record.setWeightKg(herdService.estimateWeightKg(
                    herd != null ? herd.getBreed() : null,
                    record.getHeartGirthCm(),
                    record.getBodyLengthCm()));
        }
        if (record.getRecordDate() == null) {
            record.setRecordDate(LocalDate.now());
        }

        // Calculate weight change from previous
        HerdWeightRecord lastRecord = weightRepo.findFirstByHerdIdOrderByRecordDateDesc(record.getHerdId());
        if (lastRecord != null && lastRecord.getWeightKg() != null && record.getWeightKg() != null) {
            record.setWeightChangeKg(record.getWeightKg() - lastRecord.getWeightKg());
        } else {
            record.setWeightChangeKg(0.0);
        }

        HerdWeightRecord saved = weightRepo.save(record);

        // Update main Herd entity with latest weight
        Optional<Herd> optHerd = herdRepo.findById(record.getHerdId());
        if (optHerd.isPresent()) {
            Herd herd = optHerd.get();
            // calculatedWeight stays derived - HerdService recomputes it from heartGirth.
            herd.setHeartGirth(record.getHeartGirthCm());
            herdRepo.save(herd);
        }

        return saved;
    }

    /**
     * The animals to be weighed in a round, each with its previous reading so staff can see
     * what changed while entering the new one.
     */
    public List<WeightRoundRow> getWeightRound(LocalDate roundDate) {
        LocalDate date = roundDate != null ? roundDate : LocalDate.now();
        List<WeightRoundRow> rows = new ArrayList<>();
        for (Herd herd : herdRepo.findByStatus("ACTIVE")) {
            HerdWeightRecord last = weightRepo.findFirstByHerdIdOrderByRecordDateDesc(herd.getId());
            rows.add(WeightRoundRow.of(herd, last, date));
        }
        return rows;
    }

    /**
     * Saves several readings in one go. When the round covers every active animal the chore is
     * closed automatically - there is nothing left for staff to confirm. A partial round stays
     * open, and staff can still close it by hand for animals that could not be measured.
     */
    public WeightRoundResult addWeightRecords(List<HerdWeightRecord> records, Long logId, LocalDate roundDate) {
        LocalDate date = roundDate != null ? roundDate : LocalDate.now();
        Long staffId = currentStaffId();

        List<HerdWeightRecord> saved = new ArrayList<>();
        if (records != null) {
            for (HerdWeightRecord record : records) {
                if (record.getHerdId() == null || record.getHeartGirthCm() == null) continue;
                if (record.getRecordedBy() == null) record.setRecordedBy(staffId);
                saved.add(addWeightRecord(record));
            }
        }

        List<WeightRoundRow> rows = getWeightRound(date);
        int measured = 0;
        for (WeightRoundRow row : rows) {
            if (row.isMeasuredInRound()) measured++;
        }
        boolean roundComplete = !rows.isEmpty() && measured == rows.size();

        boolean taskCompleted = roundComplete && completeTask(logId, rows.size(), staffId);
        return new WeightRoundResult(saved, measured, rows.size(), roundComplete, taskCompleted);
    }

    /**
     * Closes the chore behind the round. A chore that is already closed is left alone, so a
     * late correction to one animal does not re-stamp who finished the round.
     */
    private boolean completeTask(Long logId, int animalCount, Long staffId) {
        if (logId == null) return false;
        try {
            FarmActivityLog log = activityService.getLog(logId);
            if (log.getStatus() == ActivityStatus.COMPLETED) return true;

            activityService.updateLogStatus(logId, ActivityStatus.COMPLETED, staffId,
                    "Completed automatically - all " + animalCount + " animals measured.");
            return true;
        } catch (Exception ex) {
            // The readings are saved either way; the chore can still be closed by hand.
            logger.warn("Could not auto-complete chore {} after the weight round", logId, ex);
            return false;
        }
    }

    private Long currentStaffId() {
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth == null || auth.getName() == null) return null;
            User user = userRepository.findByEmail(auth.getName())
                    .orElseGet(() -> userRepository.findByUsername(auth.getName()).orElse(null));
            return user != null ? user.getStaffId() : null;
        } catch (Exception ex) {
            return null;
        }
    }
}
