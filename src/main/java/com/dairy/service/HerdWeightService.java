package com.dairy.service;

import com.dairy.dto.WeightRoundResult;
import com.dairy.dto.WeightRoundRow;
import com.dairy.model.ActivityStatus;
import com.dairy.model.FarmActivityLog;
import com.dairy.model.User;
import com.dairy.repo.UserRepository;
import com.dairy.model.HerdWeightRecord;
import com.dairy.model.MeasurementMethod;
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
import java.util.Set;

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
        if (!hasReading(record)) {
            throw new IllegalArgumentException("Enter a heart girth or the weight in kg.");
        }
        // No tape reading means the weight was entered straight from a scale.
        if (record.getHeartGirthCm() == null) {
            record.setMeasurementMethod(MeasurementMethod.SCALE);
        }
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

        // Keep the animal's girth current. A scale weight has no girth, so the last tape reading
        // stays; the animal's weight still follows this record (HerdService uses the latest weight).
        Optional<Herd> optHerd = herdRepo.findById(record.getHerdId());
        if (optHerd.isPresent() && record.getHeartGirthCm() != null) {
            Herd herd = optHerd.get();
            herd.setHeartGirth(record.getHeartGirthCm());
            herdRepo.save(herd);
        }

        return saved;
    }

    /** A reading needs a tape girth or a weight from a scale. */
    static boolean hasReading(HerdWeightRecord record) {
        return (record.getHeartGirthCm() != null && record.getHeartGirthCm() > 0)
                || (record.getWeightKg() != null && record.getWeightKg() > 0);
    }

    /**
     * The animals to be weighed in a round, each with its previous reading so staff can see
     * what changed while entering the new one.
     */
    public List<WeightRoundRow> getWeightRound(LocalDate roundDate) {
        LocalDate date = roundDate != null ? roundDate : LocalDate.now();
        List<WeightRoundRow> rows = new ArrayList<>();
        for (Herd herd : herdRepo.findByStatus("ACTIVE")) {
            if (!isWeighed(herd)) continue;
            HerdWeightRecord last = weightRepo.findFirstByHerdIdOrderByRecordDateDesc(herd.getId());
            rows.add(WeightRoundRow.of(herd, last, date));
        }
        return rows;
    }

    @Autowired
    private com.dairy.repo.BreedRepository breedRepository;

    /**
     * Every active weighed animal with its current weight, the weight it should be at for its
     * breed and age (see {@link WeightTarget}) and its latest body condition score - the herd
     * weight overview on Analytics & Reports. Animals furthest below target come first.
     */
    public List<com.dairy.dto.HerdWeightOverviewRow> getOverview() {
        LocalDate today = LocalDate.now();
        List<Herd> herds = new ArrayList<>();
        for (Herd herd : herdService.getAllHerds()) {
            if ("ACTIVE".equalsIgnoreCase(herd.getStatus()) && isWeighed(herd)) herds.add(herd);
        }

        java.util.Map<Long, HerdWeightRecord> latest = new java.util.HashMap<>();
        if (!herds.isEmpty()) {
            List<Long> ids = herds.stream().map(Herd::getId).toList();
            for (HerdWeightRecord r : weightRepo.findLatestByHerdIdIn(ids)) latest.put(r.getHerdId(), r);
        }
        java.util.Map<String, com.dairy.model.Breed> breeds = new java.util.HashMap<>();
        for (com.dairy.model.Breed b : breedRepository.findAll()) {
            if (b.getName() != null) breeds.put(b.getName().trim().toLowerCase(), b);
        }

        List<com.dairy.dto.HerdWeightOverviewRow> rows = new ArrayList<>();
        for (Herd herd : herds) {
            com.dairy.dto.HerdWeightOverviewRow row = new com.dairy.dto.HerdWeightOverviewRow();
            row.setHerdId(herd.getId());
            row.setTagNumber(herd.getTagNumber() != null ? herd.getTagNumber().trim() : null);
            row.setAnimalName(herd.getAnimalName() != null ? herd.getAnimalName().trim() : null);
            row.setBreed(herd.getBreed());
            row.setAnimalStatus(herd.getAnimalStatus());
            row.setDim(herd.getDim());
            row.setBirthDate(herd.getBirthDate());
            if (herd.getBirthDate() != null && !herd.getBirthDate().isAfter(today)) {
                row.setAgeMonths((int) java.time.temporal.ChronoUnit.MONTHS.between(herd.getBirthDate(), today));
            }

            // Current weight: the same number the herd card shows (latest record, else the stored girth).
            HerdWeightRecord last = latest.get(herd.getId());
            if (last != null && last.getWeightKg() != null) {
                row.setCurrentWeightKg((double) Math.round(last.getWeightKg()));
                row.setWeightDate(last.getRecordDate());
                row.setWeightMethod(last.getMeasurementMethod() != null ? last.getMeasurementMethod().name() : null);
            } else if (herd.getCalculatedWeight() != null && herd.getCalculatedWeight() > 0) {
                row.setCurrentWeightKg((double) Math.round(herd.getCalculatedWeight()));
                row.setWeightMethod("GIRTH_ESTIMATE");
            }

            String breedName = herd.getBreed() != null && !herd.getBreed().isBlank() ? herd.getBreed().trim().toLowerCase() : "unknown";
            com.dairy.model.Breed breed = breeds.getOrDefault(breedName, breeds.get("unknown"));
            WeightTarget.Result target = WeightTarget.of(breed, herd.getBirthDate(), herd.getAnimalStatus(),
                    herd.getLactationNumber(), herd.getPregnancyDaysPregnant(),
                    row.getCurrentWeightKg(), herd.getBcs(), row.getWeightDate(), today);
            row.setDaysPregnant(herd.getPregnancyDaysPregnant());
            if (target != null) {
                row.setTargetWeightKg(target.targetKg());
                row.setBreedTargetKg(target.breedTargetKg());
                row.setFrameTargetKg(target.frameTargetKg());
                row.setPregnancyKg(target.pregnancyKg());
                row.setTargetBasis(target.basis());
                Double current = row.getCurrentWeightKg();
                if (current != null) {
                    row.setGapKg(target.targetKg() - current);
                    // Only body condition calls an animal fat; weight above the minimum is frame.
                    if (herd.getBcs() != null && herd.getBcs() >= 4) row.setVerdict("OVER_CONDITIONED");
                    else if (current < target.targetKg()) row.setVerdict("SHORT");
                    else row.setVerdict(target.grown() ? "HEALTHY" : "AHEAD");
                }
            }

            row.setBcs(herd.getBcs());
            row.setBcsDate(herd.getBcsDate());
            row.setBcsLabel(HerdService.bcsLabel(herd.getBcs()));
            rows.add(row);
        }

        // Cows in lactation order - freshest calver (fewest days in milk) first - then grown animals
        // with no calving on record, then young stock oldest to youngest, so the newest calf is last.
        rows.sort(java.util.Comparator
                .comparingInt(HerdWeightService::overviewGroup)
                .thenComparing(r -> r.getDim() != null ? r.getDim() : Integer.MAX_VALUE)
                .thenComparing(com.dairy.dto.HerdWeightOverviewRow::getBirthDate,
                        java.util.Comparator.nullsLast(java.util.Comparator.naturalOrder())));
        return rows;
    }

    /** 0 = has a calving (days in milk), 1 = grown with no calving on record, 2 = calf or heifer. */
    static int overviewGroup(com.dairy.dto.HerdWeightOverviewRow r) {
        if (r.getDim() != null) return 0;
        String status = r.getAnimalStatus() == null ? "" : r.getAnimalStatus().trim().toUpperCase();
        return "CALF".equals(status) || "HEIFER".equals(status) ? 2 : 1;
    }

    /** Poultry and fish are kept as batches, not weighed by heart girth, so they are not in the round. */
    private static final Set<String> NOT_WEIGHED = Set.of("CHICKEN", "DUCK", "QUAIL", "FISH", "POULTRY");

    static boolean isWeighed(Herd herd) {
        String type = herd.getAnimalType();
        return type == null || !NOT_WEIGHED.contains(type.trim().toUpperCase());
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
                if (record.getHerdId() == null || !hasReading(record)) continue;
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
                    "Completed automatically - all " + animalCount + " animals measured.", null);
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
