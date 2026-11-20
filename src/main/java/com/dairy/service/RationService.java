package com.dairy.service;

import com.dairy.dto.ration.RationAnimalDTO;
import com.dairy.dto.ration.RationGroupDTO;
import com.dairy.model.Herd;
import com.dairy.model.ration.RationGroup;
import com.dairy.model.ration.RationItem;
import com.dairy.model.ration.RationMember;
import com.dairy.model.ration.RationPlacement;
import com.dairy.model.ration.RationPlan;
import com.dairy.repo.MilkRecordRepository;
import com.dairy.repo.ration.RationGroupRepository;
import com.dairy.repo.ration.RationItemRepository;
import com.dairy.repo.ration.RationMemberRepository;
import com.dairy.repo.ration.RationPlacementRepository;
import com.dairy.repo.ration.RationPlanRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.Period;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Feeding batches: which animals eat what, morning and evening, over the plan period.
 *
 * Who is in a batch follows the herd data: each batch can carry a rule (status, milk per day,
 * days in milk, age) and every active cow or buffalo goes to the first batch whose rule it meets.
 * Putting an animal in a batch by hand pins it there and overrides the rules. Once the rules move
 * an animal she stays in her new batch for MIN_DAYS_IN_BATCH days, unless her status changes.
 */
@Service
public class RationService {
    private static final Set<String> KINDS = Set.of("CONCENTRATE", "FODDER", "MINERAL", "MILK", "OTHER");
    private static final Set<String> UNITS = Set.of("KG", "G", "L");
    private static final Set<String> STATUSES = Set.of("CALF", "HEIFER", "PREGNANT", "LACTATING", "DRY");
    /** Animals that are fed from the ration plan; poultry and fish are not. */
    private static final Set<String> FED_TYPES = Set.of("COW", "BUFFALO");
    /** The recent milk average needs this many recorded days out of the last 7, else the 30-day one is used. */
    private static final int MIN_RECENT_DAYS = 3;
    /** Days a cow stays in a batch the rules moved her to before they may move her again. */
    static final int MIN_DAYS_IN_BATCH = 7;
    private static final Logger log = LoggerFactory.getLogger(RationService.class);

    @Autowired private RationGroupRepository groupRepo;
    @Autowired private RationItemRepository itemRepo;
    @Autowired private RationMemberRepository memberRepo;
    @Autowired private RationPlanRepository planRepo;
    @Autowired private RationPlacementRepository placementRepo;
    @Autowired private HerdService herdService;
    @Autowired private MilkRecordRepository milkRecordRepository;

    /** Everything the ration screen needs: plan, batches with today's members, and the animals with their facts. */
    public Map<String, Object> view() {
        List<RationAnimalDTO> animals = loadAnimals();
        List<RationGroupDTO> groups = listGroups(animals, true);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("plan", getPlan());
        out.put("groups", groups);
        out.put("animals", animals);
        return out;
    }

    /**
     * Batches with their members resolved; also fills groupId/pinned/ruleGroupId/heldUntil on the
     * animals passed in, and records any move the rules made so the next one can be held back.
     */
    List<RationGroupDTO> listGroups(List<RationAnimalDTO> animals, boolean recordMoves) {
        Map<Long, List<RationItem>> items = itemRepo.findAllByOrderBySortOrderAscIdAsc().stream()
                .collect(Collectors.groupingBy(RationItem::getGroupId));
        List<RationGroupDTO> groups = groupRepo.findAllByOrderBySortOrderAscIdAsc().stream()
                .map(g -> toDto(g, items.getOrDefault(g.getId(), List.of())))
                .toList();
        Map<Long, Long> pins = memberRepo.findAll().stream()
                .collect(Collectors.toMap(RationMember::getHerdId, RationMember::getGroupId, (a, b) -> a));
        Map<Long, RationPlacement> placements = placementRepo.findAll().stream()
                .collect(Collectors.toMap(RationPlacement::getHerdId, p -> p, (a, b) -> a));
        Map<Long, Long> moves = assign(groups, animals, pins, placements, LocalDate.now());
        if (recordMoves) savePlacements(moves, placements);
        return groups;
    }

    /**
     * Puts each animal in its pinned batch, else the batch the rules choose - unless the rules
     * moved her less than MIN_DAYS_IN_BATCH days ago and she still has the status her batch is
     * for: then she stays put until the days are up. A change of status (say, milking to dry)
     * moves her at once.
     *
     * @return herdId -> batch the rules now put her in (null: no batch), for every animal whose
     *         recorded placement must change
     */
    static Map<Long, Long> assign(List<RationGroupDTO> groups, List<RationAnimalDTO> animals, Map<Long, Long> pins,
                                  Map<Long, RationPlacement> placements, LocalDate today) {
        Map<Long, RationGroupDTO> byId = new HashMap<>();
        for (RationGroupDTO g : groups) {
            byId.put(g.getId(), g);
            g.setHerdIds(new ArrayList<>());
            g.setPinnedHerdIds(new ArrayList<>());
        }
        Map<Long, Long> moves = new HashMap<>();
        for (RationAnimalDTO a : animals) {
            Long ruleGroup = groups.stream().filter(g -> matches(g.getRule(), a))
                    .map(RationGroupDTO::getId).findFirst().orElse(null);
            Long pinned = pins.get(a.getId());
            if (pinned != null && !byId.containsKey(pinned)) pinned = null;
            a.setRuleGroupId(ruleGroup);
            a.setPinned(pinned != null);

            Long group;
            if (pinned != null) {
                group = pinned;
            } else {
                RationPlacement p = placements.get(a.getId());
                RationGroupDTO current = p == null ? null : byId.get(p.getGroupId());
                if (current == null) {
                    group = ruleGroup;
                    if (ruleGroup != null || p != null) moves.put(a.getId(), ruleGroup);
                    if (ruleGroup != null) a.setInBatchSince(today);
                } else if (current.getId().equals(ruleGroup)) {
                    group = ruleGroup;
                    a.setInBatchSince(p.getSince());
                } else if (today.isBefore(p.getSince().plusDays(MIN_DAYS_IN_BATCH)) && stillHerKind(current.getRule(), a)) {
                    group = current.getId();
                    a.setInBatchSince(p.getSince());
                    a.setHeldUntil(p.getSince().plusDays(MIN_DAYS_IN_BATCH));
                } else {
                    group = ruleGroup;
                    moves.put(a.getId(), ruleGroup);
                    if (ruleGroup != null) a.setInBatchSince(today);
                }
            }
            a.setGroupId(group);
            if (group != null) byId.get(group).getHerdIds().add(a.getId());
            if (pinned != null) byId.get(pinned).getPinnedHerdIds().add(a.getId());
        }
        return moves;
    }

    /** Whether her batch's rule is still for animals of her status (the hold covers milk, DIM and age, not a status change). */
    private static boolean stillHerKind(RationGroupDTO.Rule r, RationAnimalDTO a) {
        if (r == null || r.isEmpty()) return false;
        if (r.getStatuses() == null || r.getStatuses().isEmpty()) return true;
        return r.getStatuses().contains(a.getAnimalStatus() == null ? "" : a.getAnimalStatus().toUpperCase());
    }

    /** Records today's rule moves. Two screens loading at once may race on the same animal; the next load settles it. */
    private void savePlacements(Map<Long, Long> moves, Map<Long, RationPlacement> placements) {
        LocalDate today = LocalDate.now();
        for (Map.Entry<Long, Long> move : moves.entrySet()) {
            try {
                RationPlacement p = placements.get(move.getKey());
                if (move.getValue() == null) {
                    if (p != null) placementRepo.delete(p);
                    continue;
                }
                if (p == null) {
                    p = new RationPlacement();
                    p.setHerdId(move.getKey());
                }
                p.setGroupId(move.getValue());
                p.setSince(today);
                placementRepo.save(p);
            } catch (DataIntegrityViolationException | ObjectOptimisticLockingFailureException e) {
                log.debug("Ration placement for herd {} changed meanwhile: {}", move.getKey(), e.getMessage());
            }
        }
    }

    /** Whether an animal meets a batch rule. An empty rule matches no one; a range on a fact the animal lacks fails. */
    static boolean matches(RationGroupDTO.Rule r, RationAnimalDTO a) {
        if (r == null || r.isEmpty()) return false;
        if (r.getStatuses() != null && !r.getStatuses().isEmpty()) {
            String status = a.getAnimalStatus() == null ? "" : a.getAnimalStatus().toUpperCase();
            if (!r.getStatuses().contains(status)) return false;
        }
        return inRange(a.getMilkPerDay(), r.getMinMilk(), r.getMaxMilk())
                && inRange(a.getDim(), r.getMinDim(), r.getMaxDim())
                && inRange(a.getAgeMonths(), r.getMinAgeMonths(), r.getMaxAgeMonths());
    }

    private static boolean inRange(Number value, Number min, Number max) {
        if (min == null && max == null) return true;
        if (value == null) return false;
        double v = value.doubleValue();
        return (min == null || v >= min.doubleValue()) && (max == null || v <= max.doubleValue());
    }

    /** Active cows and buffaloes with the facts the rules use. */
    List<RationAnimalDTO> loadAnimals() {
        List<Herd> herds = herdService.getAllHerds().stream()
                .filter(h -> "ACTIVE".equalsIgnoreCase(h.getStatus()))
                .filter(h -> h.getAnimalType() != null && FED_TYPES.contains(h.getAnimalType().toUpperCase()))
                .sorted(Comparator.comparing(RationService::label, String.CASE_INSENSITIVE_ORDER))
                .toList();
        if (herds.isEmpty()) return new ArrayList<>();

        // Last 7 full days: today is left out because the evening milking may not be in yet.
        LocalDate today = LocalDate.now();
        Map<Long, double[]> recent = new HashMap<>(); // herdId -> {litres, days}
        List<Long> ids = herds.stream().map(Herd::getId).toList();
        for (Object[] row : milkRecordRepository.sumDailyByHerdIdsSince(ids, today.minusDays(7))) {
            if (row[0] == null || !(row[1] instanceof LocalDate day) || !day.isBefore(today)) continue;
            double[] acc = recent.computeIfAbsent(((Number) row[0]).longValue(), k -> new double[2]);
            acc[0] += row[2] == null ? 0 : ((Number) row[2]).doubleValue();
            acc[1]++;
        }

        List<RationAnimalDTO> out = new ArrayList<>();
        for (Herd h : herds) {
            RationAnimalDTO a = new RationAnimalDTO();
            a.setId(h.getId());
            a.setAnimalName(h.getAnimalName());
            a.setTagNumber(h.getTagNumber());
            a.setAnimalType(h.getAnimalType());
            a.setAnimalStatus(h.getAnimalStatus());
            a.setBreed(h.getBreed());
            a.setBcs(h.getBcs());
            a.setDim(h.getDim());
            a.setPregnancyDays(h.getPregnancyDaysPregnant());
            if (h.getBirthDate() != null && !h.getBirthDate().isAfter(today)) {
                a.setAgeMonths((int) Period.between(h.getBirthDate(), today).toTotalMonths());
            }
            double[] acc = recent.get(h.getId());
            if (acc != null && acc[1] >= MIN_RECENT_DAYS) a.setMilk7Days(round1(acc[0] / acc[1]));
            if (h.getAvgMilk30Days() != null && h.getAvgMilk30Days() > 0) a.setAvgMilk30Days(round1(h.getAvgMilk30Days()));
            a.setMilkPerDay(a.getMilk7Days() != null ? a.getMilk7Days() : a.getAvgMilk30Days());
            out.add(a);
        }
        return out;
    }

    private static String label(Herd h) {
        return h.getAnimalName() != null && !h.getAnimalName().isBlank() ? h.getAnimalName() : String.valueOf(h.getTagNumber());
    }

    private static Double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }

    @Transactional
    public RationGroupDTO saveGroup(Long id, RationGroupDTO in) {
        if (in.getName() == null || in.getName().isBlank())
            throw new IllegalArgumentException("Batch name is required");
        RationGroup g = id == null ? new RationGroup()
                : groupRepo.findById(id).orElseThrow(() -> new NoSuchElementException("Batch not found: " + id));
        g.setName(in.getName().trim());
        g.setColor(in.getColor());
        g.setNotes(in.getNotes());
        if (in.getSortOrder() != null) g.setSortOrder(in.getSortOrder());
        else if (id == null) g.setSortOrder(groupRepo.findAll().size());
        // The rule and the milk the lines are written for travel together; leave both out to keep them.
        if (in.getRule() != null) {
            applyRule(g, in.getRule());
            if (in.getRefMilk() != null && in.getRefMilk() <= 0)
                throw new IllegalArgumentException("Milk the ration is written for must be more than 0 L");
            g.setRefMilk(in.getRefMilk());
        }
        g = groupRepo.save(g);

        itemRepo.deleteByGroupId(g.getId());
        itemRepo.flush();
        int order = 0;
        for (RationItem src : in.getItems() == null ? List.<RationItem>of() : in.getItems()) {
            if (src.getName() == null || src.getName().isBlank()) continue;
            RationItem it = new RationItem();
            it.setGroupId(g.getId());
            it.setStoreItemId(src.getStoreItemId());
            it.setName(src.getName().trim());
            it.setKind(KINDS.contains(src.getKind()) ? src.getKind() : "CONCENTRATE");
            it.setUnit(UNITS.contains(src.getUnit()) ? src.getUnit() : "KG");
            it.setMorningQty(nonNegative(src.getMorningQty()));
            it.setEveningQty(nonNegative(src.getEveningQty()));
            it.setFromDate(src.getFromDate());
            it.setToDate(src.getToDate());
            it.setScaleWithMilk(Boolean.TRUE.equals(src.getScaleWithMilk()));
            it.setSortOrder(order++);
            itemRepo.save(it);
        }

        // herdIds, when sent, replaces the animals pinned to this batch by hand; leave it out to keep them.
        if (in.getHerdIds() != null) {
            Set<Long> keep = new HashSet<>(in.getHerdIds());
            Long groupId = g.getId();
            memberRepo.findAll().stream()
                    .filter(m -> m.getGroupId().equals(groupId) && !keep.contains(m.getHerdId()))
                    .forEach(memberRepo::delete);
            for (Long herdId : keep) setMember(herdId, groupId);
        }
        memberRepo.flush();
        Long groupId = g.getId();
        // Read-only here: a placement write racing another screen must not roll back the save.
        return listGroups(loadAnimals(), false).stream().filter(d -> d.getId().equals(groupId)).findFirst().orElseThrow();
    }

    private static void applyRule(RationGroup g, RationGroupDTO.Rule r) {
        List<String> statuses = r.getStatuses() == null ? List.of() : r.getStatuses().stream()
                .filter(Objects::nonNull).map(String::toUpperCase).filter(STATUSES::contains).distinct().toList();
        checkRange("Milk per day", r.getMinMilk(), r.getMaxMilk());
        checkRange("Days in milk", r.getMinDim(), r.getMaxDim());
        checkRange("Age in months", r.getMinAgeMonths(), r.getMaxAgeMonths());
        g.setRuleStatuses(statuses.isEmpty() ? null : String.join(",", statuses));
        g.setRuleMinMilk(r.getMinMilk());
        g.setRuleMaxMilk(r.getMaxMilk());
        g.setRuleMinDim(r.getMinDim());
        g.setRuleMaxDim(r.getMaxDim());
        g.setRuleMinAgeMonths(r.getMinAgeMonths());
        g.setRuleMaxAgeMonths(r.getMaxAgeMonths());
    }

    private static void checkRange(String what, Number min, Number max) {
        if ((min != null && min.doubleValue() < 0) || (max != null && max.doubleValue() < 0))
            throw new IllegalArgumentException(what + " can't be negative");
        if (min != null && max != null && min.doubleValue() > max.doubleValue())
            throw new IllegalArgumentException(what + ": the lowest is more than the highest");
    }

    @Transactional
    public void deleteGroup(Long id) {
        itemRepo.deleteByGroupId(id);
        memberRepo.deleteByGroupId(id);
        placementRepo.deleteByGroupId(id);
        groupRepo.deleteById(id);
    }

    /**
     * Pins an animal to a batch by hand, or hands it back to the batch rules when groupId is null.
     * Either way it is the owner's call, so any hold from an earlier rule move is dropped.
     */
    @Transactional
    public void setMember(Long herdId, Long groupId) {
        placementRepo.deleteByHerdIdIn(List.of(herdId));
        Optional<RationMember> existing = memberRepo.findByHerdId(herdId);
        if (groupId == null) {
            existing.ifPresent(memberRepo::delete);
            return;
        }
        if (!groupRepo.existsById(groupId)) throw new NoSuchElementException("Batch not found: " + groupId);
        RationMember m = existing.orElseGet(RationMember::new);
        m.setHerdId(herdId);
        m.setGroupId(groupId);
        memberRepo.save(m);
    }

    /** Hands these animals to the batch rules now: removes their pins and any hold, so they go where the rules say today. */
    @Transactional
    public void unpin(Collection<Long> herdIds) {
        if (herdIds.isEmpty()) return;
        placementRepo.deleteByHerdIdIn(herdIds);
        for (Long herdId : herdIds) memberRepo.findByHerdId(herdId).ifPresent(memberRepo::delete);
    }

    public RationPlan getPlan() {
        return planRepo.findById(1L).orElseGet(RationPlan::new);
    }

    @Transactional
    public RationPlan savePlan(RationPlan in) {
        RationPlan p = getPlan();
        p.setStartDate(in.getStartDate());
        if (in.getDays() != null) p.setDays(Math.max(1, Math.min(in.getDays(), 366)));
        if (in.getWastagePct() != null) p.setWastagePct(Math.max(0, Math.min(in.getWastagePct(), 50)));
        if (in.getProducts() != null) p.setProducts(in.getProducts());
        return planRepo.save(p);
    }

    private static Double nonNegative(Double v) {
        return v == null || v < 0 ? 0.0 : v;
    }

    private static RationGroupDTO toDto(RationGroup g, List<RationItem> items) {
        RationGroupDTO d = new RationGroupDTO();
        d.setId(g.getId());
        d.setName(g.getName());
        d.setColor(g.getColor());
        d.setNotes(g.getNotes());
        d.setSortOrder(g.getSortOrder());
        d.setItems(new ArrayList<>(items));
        d.setRefMilk(g.getRefMilk());
        RationGroupDTO.Rule r = new RationGroupDTO.Rule();
        if (g.getRuleStatuses() != null && !g.getRuleStatuses().isBlank()) {
            r.setStatuses(new ArrayList<>(Arrays.asList(g.getRuleStatuses().split(","))));
        }
        r.setMinMilk(g.getRuleMinMilk());
        r.setMaxMilk(g.getRuleMaxMilk());
        r.setMinDim(g.getRuleMinDim());
        r.setMaxDim(g.getRuleMaxDim());
        r.setMinAgeMonths(g.getRuleMinAgeMonths());
        r.setMaxAgeMonths(g.getRuleMaxAgeMonths());
        d.setRule(r);
        return d;
    }
}
