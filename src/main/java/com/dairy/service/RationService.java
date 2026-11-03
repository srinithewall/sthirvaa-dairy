package com.dairy.service;

import com.dairy.dto.ration.RationGroupDTO;
import com.dairy.model.ration.RationGroup;
import com.dairy.model.ration.RationItem;
import com.dairy.model.ration.RationMember;
import com.dairy.model.ration.RationPlan;
import com.dairy.repo.ration.RationGroupRepository;
import com.dairy.repo.ration.RationItemRepository;
import com.dairy.repo.ration.RationMemberRepository;
import com.dairy.repo.ration.RationPlanRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

/** Feeding batches: which animals eat what, morning and evening, over the plan period. */
@Service
public class RationService {
    private static final Set<String> KINDS = Set.of("CONCENTRATE", "FODDER", "MINERAL", "MILK", "OTHER");
    private static final Set<String> UNITS = Set.of("KG", "G", "L");

    @Autowired private RationGroupRepository groupRepo;
    @Autowired private RationItemRepository itemRepo;
    @Autowired private RationMemberRepository memberRepo;
    @Autowired private RationPlanRepository planRepo;

    public List<RationGroupDTO> listGroups() {
        Map<Long, List<RationItem>> items = itemRepo.findAllByOrderBySortOrderAscIdAsc().stream()
                .collect(Collectors.groupingBy(RationItem::getGroupId));
        Map<Long, List<Long>> members = memberRepo.findAll().stream()
                .collect(Collectors.groupingBy(RationMember::getGroupId,
                        Collectors.mapping(RationMember::getHerdId, Collectors.toList())));
        return groupRepo.findAllByOrderBySortOrderAscIdAsc().stream()
                .map(g -> toDto(g, items.getOrDefault(g.getId(), List.of()), members.getOrDefault(g.getId(), List.of())))
                .toList();
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
            it.setSortOrder(order++);
            itemRepo.save(it);
        }

        // herdIds, when sent, replaces who is in this batch; leave it out to keep the animals as they are.
        if (in.getHerdIds() != null) {
            Set<Long> keep = new HashSet<>(in.getHerdIds());
            Long groupId = g.getId();
            memberRepo.findAll().stream()
                    .filter(m -> m.getGroupId().equals(groupId) && !keep.contains(m.getHerdId()))
                    .forEach(memberRepo::delete);
            for (Long herdId : keep) setMember(herdId, groupId);
        }
        Long groupId = g.getId();
        return listGroups().stream().filter(d -> d.getId().equals(groupId)).findFirst().orElseThrow();
    }

    @Transactional
    public void deleteGroup(Long id) {
        itemRepo.deleteByGroupId(id);
        memberRepo.deleteByGroupId(id);
        groupRepo.deleteById(id);
    }

    /** Moves an animal into a batch, or out of every batch when groupId is null. */
    @Transactional
    public void setMember(Long herdId, Long groupId) {
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

    private static RationGroupDTO toDto(RationGroup g, List<RationItem> items, List<Long> herdIds) {
        RationGroupDTO d = new RationGroupDTO();
        d.setId(g.getId());
        d.setName(g.getName());
        d.setColor(g.getColor());
        d.setNotes(g.getNotes());
        d.setSortOrder(g.getSortOrder());
        d.setItems(new ArrayList<>(items));
        d.setHerdIds(new ArrayList<>(herdIds));
        return d;
    }
}
