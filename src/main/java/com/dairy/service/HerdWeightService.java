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
        LocalDate day = record.getRecordDate();
        List<HerdWeightRecord> earlier = weightRepo.findByHerdIdOrderByRecordDateDesc(record.getHerdId());

        // One reading per animal per day: entering the day again corrects it instead of adding a
        // second reading. A BCS or note on the first entry is kept unless the new one brings its own.
        HerdWeightRecord sameDay = weightRepo
                .findByHerdIdAndRecordDateBetweenOrderByRecordDateAsc(record.getHerdId(), day, day)
                .stream().findFirst().orElse(null);
        if (sameDay != null) {
            record.setId(sameDay.getId());
            record.setCreatedAt(sameDay.getCreatedAt());
            if (record.getBodyConditionScore() == null) record.setBodyConditionScore(sameDay.getBodyConditionScore());
            if (record.getNotes() == null) record.setNotes(sameDay.getNotes());
        }

        // Weight change against the reading before this day (not the latest, which may be later).
        HerdWeightRecord previous = earlier.stream()
                .filter(r -> r.getRecordDate() != null && r.getRecordDate().isBefore(day) && r.getWeightKg() != null)
                .findFirst().orElse(null);
        if (previous != null && record.getWeightKg() != null) {
            record.setWeightChangeKg(record.getWeightKg() - previous.getWeightKg());
        } else {
            record.setWeightChangeKg(0.0);
        }
        boolean latestDay = earlier.stream().noneMatch(r -> r.getRecordDate() != null && r.getRecordDate().isAfter(day));

        HerdWeightRecord saved = weightRepo.save(record);

        // Keep the animal's girth current. A scale weight has no girth, so the last tape reading
        // stays; the animal's weight still follows this record (HerdService uses the latest weight).
        // A reading entered for an earlier day leaves a later girth alone.
        Optional<Herd> optHerd = herdRepo.findById(record.getHerdId());
        if (optHerd.isPresent() && record.getHeartGirthCm() != null && latestDay) {
            Herd herd = optHerd.get();
            herd.setHeartGirth(record.getHeartGirthCm());
            herdRepo.save(herd);
        }

        return saved;
    }

    /**
     * Corrects one reading in place. Only the fields sent change; a new date must not already have
     * a reading for this animal (enter that day again instead to correct it).
     */
    public Optional<HerdWeightRecord> updateWeightRecord(Long herdId, Long id, HerdWeightRecord changes) {
        Optional<HerdWeightRecord> found = weightRepo.findById(id).filter(r -> herdId.equals(r.getHerdId()));
        if (found.isEmpty()) return Optional.empty();
        HerdWeightRecord r = found.get();
        LocalDate day = changes.getRecordDate() != null ? changes.getRecordDate() : r.getRecordDate();
        if (!day.equals(r.getRecordDate())
                && !weightRepo.findByHerdIdAndRecordDateBetweenOrderByRecordDateAsc(herdId, day, day).isEmpty()) {
            throw new IllegalStateException("There is already a reading on " + day + " for this animal.");
        }
        r.setRecordDate(day);
        if (changes.getHeartGirthCm() != null) r.setHeartGirthCm(changes.getHeartGirthCm());
        if (changes.getBodyLengthCm() != null) r.setBodyLengthCm(changes.getBodyLengthCm());
        if (changes.getWeightKg() != null) r.setWeightKg(changes.getWeightKg());
        if (changes.getMeasurementMethod() != null) r.setMeasurementMethod(changes.getMeasurementMethod());
        if (changes.getNotes() != null) r.setNotes(changes.getNotes().isBlank() ? null : changes.getNotes());

        List<HerdWeightRecord> all = weightRepo.findByHerdIdOrderByRecordDateDesc(herdId);
        HerdWeightRecord previous = all.stream()
                .filter(o -> !o.getId().equals(r.getId()) && o.getRecordDate() != null && o.getRecordDate().isBefore(day) && o.getWeightKg() != null)
                .findFirst().orElse(null);
        r.setWeightChangeKg(previous != null && r.getWeightKg() != null ? r.getWeightKg() - previous.getWeightKg() : 0.0);
        HerdWeightRecord saved = weightRepo.save(r);

        // Keep the animal's girth current when this is her newest reading.
        boolean latestDay = all.stream().noneMatch(o -> !o.getId().equals(r.getId()) && o.getRecordDate() != null && o.getRecordDate().isAfter(day));
        if (latestDay && r.getHeartGirthCm() != null) {
            herdRepo.findById(herdId).ifPresent(herd -> { herd.setHeartGirth(r.getHeartGirthCm()); herdRepo.save(herd); });
        }
        return Optional.of(saved);
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
        List<Herd> herds = new ArrayList<>();
        for (Herd herd : herdService.getAllHerds()) {
            if ("ACTIVE".equalsIgnoreCase(herd.getStatus()) && isWeighed(herd)) herds.add(herd);
        }
        // Same order as the weight report and other screens: cows by days in milk, freshest calver
        // first, then grown animals with no calving, then young stock oldest to youngest.
        herds.sort(java.util.Comparator
                .comparingInt((Herd h) -> roundGroup(h.getDim(), h.getAnimalStatus()))
                .thenComparing(h -> h.getDim() != null ? h.getDim() : Integer.MAX_VALUE)
                .thenComparing(Herd::getBirthDate, java.util.Comparator.nullsLast(java.util.Comparator.naturalOrder())));
        List<WeightRoundRow> rows = new ArrayList<>();
        for (Herd herd : herds) {
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
        java.util.Map<Long, List<WeightTarget.Weighing>> weighings = new java.util.HashMap<>();
        java.util.Map<Long, List<HerdWeightRecord>> records = new java.util.HashMap<>();
        if (!herds.isEmpty()) {
            List<Long> ids = herds.stream().map(Herd::getId).toList();
            for (HerdWeightRecord r : weightRepo.findLatestByHerdIdIn(ids)) latest.put(r.getHerdId(), r);
            for (HerdWeightRecord r : weightRepo.findByHerdIdIn(ids)) {
                records.computeIfAbsent(r.getHerdId(), k -> new ArrayList<>()).add(r);
                WeightTarget.Weighing w = weighing(r);
                if (w != null) weighings.computeIfAbsent(r.getHerdId(), k -> new ArrayList<>()).add(w);
            }
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
            // Her frame comes from the weighing her BCS was given against, not the latest one.
            WeightTarget.Weighing frame = herd.getBcs() != null
                    ? WeightTarget.frameWeighing(weighings.get(herd.getId()), herd.getBcsDate()) : null;
            // Her base minimum is fixed. A scored grown cow without one gets the app's suggestion once
            // (her frame at BCS 3, open); after that only a person changes it.
            Double base = herd.getBaseMinWeightKg();
            if (base == null && herd.getBcs() != null) {
                WeightTarget.Result est = WeightTarget.of(breed, herd.getBirthDate(), herd.getAnimalStatus(),
                        herd.getLactationNumber(), herd.getPregnancyDaysPregnant(),
                        row.getCurrentWeightKg(), herd.getBcs(), row.getWeightDate(), frame, today);
                if (est != null && est.grown() && est.frameTargetKg() != null) {
                    base = (double) Math.round(est.frameTargetKg() - est.pregnancyKg());
                    herdRepo.suggestBaseMinWeight(herd.getId(), base, today);
                    herd.setBaseMinWeightKg(base);
                    herd.setBaseMinWeightDate(today);
                    herd.setBaseMinWeightManual(false);
                }
            }
            WeightTarget.Result target = WeightTarget.of(breed, herd.getBirthDate(), herd.getAnimalStatus(),
                    herd.getLactationNumber(), herd.getPregnancyDaysPregnant(),
                    row.getCurrentWeightKg(), herd.getBcs(), row.getWeightDate(), frame, base, today);
            row.setDaysPregnant(herd.getPregnancyDaysPregnant());
            if (target != null) {
                row.setTargetWeightKg(target.targetKg());
                row.setBreedTargetKg(target.breedTargetKg());
                row.setFrameTargetKg(target.frameTargetKg());
                row.setPregnancyKg(target.pregnancyKg());
                row.setTargetBasis(target.basis());
                Double current = row.getCurrentWeightKg();
                if (target.grown() && base != null) {
                    row.setBaseMinWeightKg(base);
                    row.setBaseMinWeightDate(herd.getBaseMinWeightDate());
                    row.setBaseManual(Boolean.TRUE.equals(herd.getBaseMinWeightManual()));
                    // Sunday check: does the weight agree with what her BCS says she should weigh?
                    if (herd.getBcs() != null && current != null) {
                        Integer pregThen = WeightTarget.daysPregnantOn(herd.getPregnancyDaysPregnant(), row.getWeightDate(), today);
                        double expected = WeightTarget.expectedAtBcs(base, herd.getBcs(), pregThen);
                        row.setExpectedAtBcsKg((double) Math.round(expected));
                        row.setBcsMatchPct(Math.round((current - expected) / expected * 1000) / 10.0);
                    }
                    checkBreed(row, herd, base, breed);
                }
                if (current != null) {
                    row.setGapKg(target.targetKg() - current);
                    // Only body condition calls an animal fat; weight above the minimum is frame.
                    if (herd.getBcs() != null && herd.getBcs() >= 4) row.setVerdict("OVER_CONDITIONED");
                    else if (current < target.targetKg()) row.setVerdict("SHORT");
                    else if (!target.grown()) row.setVerdict("AHEAD");
                    // Weight alone is not health: a grown cow also needs good cover (BCS 3.5+).
                    else if (herd.getBcs() != null && herd.getBcs() >= WeightTarget.HEALTHY_MIN_BCS) row.setVerdict("HEALTHY");
                    else row.setVerdict("LOW_BCS");
                }
            }

            row.setBcs(herd.getBcs());
            row.setBcsDate(herd.getBcsDate());
            row.setBcsLabel(HerdService.bcsLabel(herd.getBcs()));
            latestGirth(row, herd, records.getOrDefault(herd.getId(), List.of()), today);
            rows.add(row);
        }

        // Base check by girth: the herd's other bases per cm2 of girth, times hers.
        List<com.dairy.dto.HerdWeightOverviewRow> sized = rows.stream()
                .filter(r -> r.getBaseMinWeightKg() != null && r.getGirthCm() != null && r.getGirthCm() > 0
                        && r.getGirthPregnantDays() == null).toList();
        for (com.dairy.dto.HerdWeightOverviewRow r : sized) {
            List<double[]> others = new ArrayList<>();
            for (com.dairy.dto.HerdWeightOverviewRow o : sized) {
                if (o != r) others.add(new double[]{o.getBaseMinWeightKg(), o.getGirthCm()});
            }
            Double est = BaseCheck.girthEstimate(r.getGirthCm(), others);
            if (est == null) continue;
            r.setGirthBaseKg((double) Math.round(est));
            r.setGirthCheck(BaseCheck.against(r.getBaseMinWeightKg(), est, est, BaseCheck.TOLERANCE).name());
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

    /** Her base against her breed's range from the breed table (not for an unknown breed). See {@link BaseCheck}. */
    private static void checkBreed(com.dairy.dto.HerdWeightOverviewRow row, Herd herd, double base,
                                   com.dairy.model.Breed breed) {
        boolean knownBreed = breed != null && breed.getName() != null && !"unknown".equalsIgnoreCase(breed.getName().trim())
                && herd.getBreed() != null && !herd.getBreed().isBlank();
        if (knownBreed && breed.getBelowAvgMax() != null && breed.getBelowAvgMax() > 0) {
            double lo = breed.getBelowAvgMax();
            double hi = breed.getAvgMax() != null && breed.getAvgMax() > lo ? breed.getAvgMax() : lo;
            row.setBreedLowKg(lo);
            row.setBreedHighKg(hi);
            row.setBreedCheck(BaseCheck.against(base, lo, hi, BaseCheck.BREED_TOLERANCE).name());
        }
    }

    /**
     * Her latest heart girth (the newest weighing that has one, else the girth on her record), shown
     * for every animal. A girth taken late in pregnancy is marked so the girth check leaves it out.
     */
    private static void latestGirth(com.dairy.dto.HerdWeightOverviewRow row, Herd herd,
                                    List<HerdWeightRecord> records, LocalDate today) {
        HerdWeightRecord girthRecord = null;
        for (HerdWeightRecord w : records) {
            if (w.getRecordDate() == null || w.getHeartGirthCm() == null || w.getHeartGirthCm() <= 0) continue;
            if (girthRecord == null || w.getRecordDate().isAfter(girthRecord.getRecordDate())) girthRecord = w;
        }
        if (girthRecord != null) {
            row.setGirthCm(girthRecord.getHeartGirthCm());
            row.setGirthDate(girthRecord.getRecordDate());
        } else if (herd.getHeartGirth() != null && herd.getHeartGirth() > 0) {
            row.setGirthCm(herd.getHeartGirth());
        }
        if (row.getGirthCm() != null) {
            Integer pregThen = WeightTarget.daysPregnantOn(herd.getPregnancyDaysPregnant(), row.getGirthDate(), today);
            if (!BaseCheck.girthShowsFrame(pregThen)) row.setGirthPregnantDays(pregThen);
        }
    }

    /** A weight record as a {@link WeightTarget.Weighing}; null when it has no date or weight. */
    static WeightTarget.Weighing weighing(HerdWeightRecord r) {
        if (r == null || r.getRecordDate() == null || r.getWeightKg() == null || r.getWeightKg() <= 0) return null;
        boolean scale = r.getMeasurementMethod() != null && "SCALE".equals(r.getMeasurementMethod().name());
        return new WeightTarget.Weighing(r.getRecordDate(), Math.round(r.getWeightKg()), scale);
    }

    /** 0 = has a calving (days in milk), 1 = grown with no calving on record, 2 = calf or heifer. */
    static int overviewGroup(com.dairy.dto.HerdWeightOverviewRow r) {
        return roundGroup(r.getDim(), r.getAnimalStatus());
    }

    static int roundGroup(Integer dim, String animalStatus) {
        if (dim != null) return 0;
        String status = animalStatus == null ? "" : animalStatus.trim().toUpperCase();
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
