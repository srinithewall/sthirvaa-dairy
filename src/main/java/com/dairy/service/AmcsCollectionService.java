package com.dairy.service;

import com.dairy.model.AmcsCollection;
import com.dairy.model.Customer;
import com.dairy.model.Income;
import com.dairy.model.MilkDispatch;
import com.dairy.repo.AmcsCollectionRepository;
import com.dairy.repo.CustomerRepository;
import com.dairy.repo.IncomeRepository;
import com.dairy.repo.MilkDispatchRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

/**
 * Imports the society's AMCS milk-collection rows and keeps one MilkDispatch per date+shift in
 * step with them, so the dashboard and MILK_SALES income reflect what KMF actually paid.
 *
 * Imports are idempotent: a row is identified by member + date + shift + sample number, so
 * re-sending an overlapping date range updates rows in place instead of duplicating them.
 */
@Service
public class AmcsCollectionService {

    private static final double EPSILON = 1e-9;

    @Autowired private AmcsCollectionRepository collectionRepository;
    @Autowired private MilkDispatchRepository dispatchRepository;
    @Autowired private CustomerRepository customerRepository;
    @Autowired private IncomeRepository incomeRepository;

    // The Customer the milk is dispatched to: the society that buys it. An existing customer with
    // this name is reused; one is created on first import only if none exists.
    @Value("${amcs.customer-name}")
    private String customerName;

    /**
     * Each row is an element of the AMCS "data" array:
     * { memberCode, collectionDate "2026-10-01 06:00:00.000000", shiftCode "Morning"/"Evening",
     *   sampleNo, quantity, fat, snf, clr, rate, amount, animalTypeName, isQualityAuto, isQuantityAuto }
     */
    @Transactional
    public Map<String, Object> importRows(List<Map<String, Object>> rows) {
        int inserted = 0, updated = 0, unchanged = 0;
        List<String> rejected = new ArrayList<>();
        Set<String> affectedShifts = new LinkedHashSet<>();
        Set<LocalDate> affectedDates = new LinkedHashSet<>();

        for (int i = 0; i < rows.size(); i++) {
            Map<String, Object> row = rows.get(i);
            ParsedRow p;
            try {
                p = parse(row);
            } catch (IllegalArgumentException ex) {
                rejected.add("row " + i + ": " + ex.getMessage());
                continue;
            }

            Optional<AmcsCollection> existing = collectionRepository
                .findByMemberCodeAndDateAndShiftAndSampleNo(p.memberCode, p.date, p.shift, p.sampleNo);
            AmcsCollection c = existing.orElseGet(AmcsCollection::new);
            boolean changed = existing.isEmpty() || differs(c, p);
            if (changed) {
                apply(c, p);
                collectionRepository.save(c);
            }
            if (existing.isEmpty()) inserted++;
            else if (changed) updated++;
            else unchanged++;

            // Re-derive the dispatch for every imported shift, changed or not: the dispatch row
            // may have been wiped by someone re-saving that shift on the dispatch screen.
            affectedShifts.add(p.date + "|" + p.shift);
            affectedDates.add(p.date);
        }

        int dispatches = 0;
        Set<LocalDate> datesSynced = new LinkedHashSet<>();
        Set<LocalDate> datesSkipped = new LinkedHashSet<>();
        for (String key : affectedShifts) {
            String[] parts = key.split("\\|");
            LocalDate date = LocalDate.parse(parts[0]);
            if (syncDispatch(date, parts[1])) {
                dispatches++;
                datesSynced.add(date);
            } else {
                datesSkipped.add(date);
            }
        }
        for (LocalDate date : datesSynced) {
            recalculateDailyIncome(date);
        }

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("received", rows.size());
        summary.put("inserted", inserted);
        summary.put("updated", updated);
        summary.put("unchanged", unchanged);
        summary.put("rejected", rejected);
        summary.put("shiftsSynced", dispatches);
        // Dates where the customer already has hand-entered dispatches (e.g. the COMBINED shift
        // from the Distribute screen). The AMCS rows are still stored, but no second dispatch is
        // added, which would double that day's income.
        summary.put("datesSkippedManualDispatch", datesSkipped.stream().map(LocalDate::toString).toList());
        return summary;
    }

    @Transactional(readOnly = true)
    public List<AmcsCollection> getBetween(LocalDate from, LocalDate to) {
        return collectionRepository.findByDateBetweenOrderByDateDescShiftAsc(from, to);
    }

    /**
     * One CUSTOMER dispatch to the AMCS customer for the shift, totalling all its pours.
     * Returns false, leaving the dispatches alone, when the customer already has dispatches on
     * that date under another shift label (the Distribute screen's COMBINED rows).
     */
    private boolean syncDispatch(LocalDate date, String shift) {
        Customer customer = resolveCustomer();
        for (MilkDispatch d : dispatchRepository.findByDate(date)) {
            if ("CUSTOMER".equals(d.getDispatchType())
                && d.getCustomer() != null
                && Objects.equals(d.getCustomer().getId(), customer.getId())
                && !"MORNING".equals(d.getShift()) && !"EVENING".equals(d.getShift())) {
                return false;
            }
        }

        List<AmcsCollection> pours = collectionRepository.findByDateAndShift(date, shift);
        double litres = pours.stream().mapToDouble(AmcsCollection::getQuantity).sum();
        double amount = pours.stream().mapToDouble(AmcsCollection::getAmount).sum();

        List<MilkDispatch> mine = new ArrayList<>();
        for (MilkDispatch d : dispatchRepository.findByDateAndShift(date, shift)) {
            if ("CUSTOMER".equals(d.getDispatchType())
                && d.getCustomer() != null
                && Objects.equals(d.getCustomer().getId(), customer.getId())) {
                mine.add(d);
            }
        }

        if (litres <= 0) {
            dispatchRepository.deleteAll(mine);
            return true;
        }

        MilkDispatch dispatch = mine.isEmpty() ? new MilkDispatch() : mine.get(0);
        if (mine.size() > 1) {
            dispatchRepository.deleteAll(mine.subList(1, mine.size()));
        }
        dispatch.setDate(date);
        dispatch.setShift(shift);
        dispatch.setDispatchType("CUSTOMER");
        dispatch.setCustomer(customer);
        dispatch.setQuantity(litres);
        // Effective rate across the shift's pours; the amount is AMCS's own figure, not litres x rate
        dispatch.setRatePerLitre(amount / litres);
        dispatch.setTotalAmount(amount);
        dispatchRepository.save(dispatch);
        return true;
    }

    /** Same upsert MilkDispatchService does after a dispatch session, for the dates we touched. */
    private void recalculateDailyIncome(LocalDate date) {
        Double total = dispatchRepository.sumRevenueByDate(date);
        if (total == null) total = 0.0;

        Income income = incomeRepository.findByCategoryAndDate("MILK_SALES", date).orElse(new Income());
        income.setCategory("MILK_SALES");
        income.setDate(date);
        income.setAmount(total);
        income.setDescription(String.format("Milk sales revenue for %s", date));
        incomeRepository.save(income);
    }

    private Customer resolveCustomer() {
        return customerRepository.findFirstByNameIgnoreCase(customerName).orElseGet(() -> {
            Customer c = new Customer();
            c.setName(customerName);
            c.setPhone("-");
            return customerRepository.save(c);
        });
    }

    // ---- parsing -------------------------------------------------------------------------

    private static final class ParsedRow {
        String memberCode;
        LocalDate date;
        String shift;
        int sampleNo;
        String animalType;
        double quantity;
        Double fat, snf, clr, rate;
        double amount;
        Boolean qualityManual, quantityManual;
        String updatedBy;
        LocalDateTime updatedAt;
    }

    private static ParsedRow parse(Map<String, Object> row) {
        ParsedRow p = new ParsedRow();

        Object member = row.get("memberCode");
        if (member == null || member.toString().isBlank()) throw new IllegalArgumentException("memberCode missing");
        p.memberCode = member.toString().trim();

        Object when = row.get("collectionDate");
        if (when == null || when.toString().length() < 10) throw new IllegalArgumentException("collectionDate missing");
        try {
            p.date = LocalDate.parse(when.toString().substring(0, 10));
        } catch (RuntimeException ex) {
            throw new IllegalArgumentException("bad collectionDate " + when);
        }

        Object shift = row.get("shiftCode");
        String s = shift == null ? "" : shift.toString().trim().toUpperCase();
        if (!s.equals("MORNING") && !s.equals("EVENING")) throw new IllegalArgumentException("unknown shiftCode " + shift);
        p.shift = s;

        Double q = number(row.get("quantity"));
        if (q == null || q <= 0) throw new IllegalArgumentException("quantity must be positive");
        p.quantity = q;

        Double sample = number(row.get("sampleNo"));
        p.sampleNo = sample == null ? 0 : sample.intValue();

        p.fat = number(row.get("fat"));
        p.snf = number(row.get("snf"));
        p.clr = number(row.get("clr"));
        p.rate = number(row.get("rate"));

        Double amount = number(row.get("amount"));
        if (amount == null && p.rate != null) amount = q * p.rate;
        if (amount == null) throw new IllegalArgumentException("amount missing");
        p.amount = amount;

        Object type = row.get("animalTypeName");
        p.animalType = type == null ? null : type.toString();

        // AMCS flags auto-read values; a "not auto" value was keyed in by hand
        p.qualityManual = row.get("isQualityAuto") instanceof Boolean b ? !b : null;
        p.quantityManual = row.get("isQuantityAuto") instanceof Boolean b ? !b : null;

        Object by = row.get("updatedBy");
        p.updatedBy = by == null || by.toString().isBlank() ? null : by.toString().trim();
        p.updatedAt = timestamp(row.get("updatedAt"));
        return p;
    }

    /** AMCS timestamps look like "2026-10-01 06:00:00.000000"; anything unreadable becomes null. */
    private static LocalDateTime timestamp(Object o) {
        if (o == null || o.toString().length() < 19) return null;
        try {
            return LocalDateTime.parse(o.toString().substring(0, 19).replace(' ', 'T'));
        } catch (RuntimeException ex) {
            return null;
        }
    }

    private static Double number(Object o) {
        if (o == null) return null;
        if (o instanceof Number n) return n.doubleValue();
        String s = o.toString().trim();
        if (s.isEmpty()) return null;
        try {
            return Double.parseDouble(s);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private static boolean differs(AmcsCollection c, ParsedRow p) {
        return !same(c.getQuantity(), p.quantity) || !same(c.getAmount(), p.amount)
            || !same(c.getFat(), p.fat) || !same(c.getSnf(), p.snf) || !same(c.getClr(), p.clr)
            || !same(c.getRatePerLitre(), p.rate)
            || !Objects.equals(c.getAnimalType(), p.animalType)
            || !Objects.equals(c.getQualityManual(), p.qualityManual)
            || !Objects.equals(c.getQuantityManual(), p.quantityManual)
            || !Objects.equals(c.getAmcsUpdatedBy(), p.updatedBy)
            || !Objects.equals(c.getAmcsUpdatedAt(), p.updatedAt);
    }

    private static boolean same(Double a, Double b) {
        if (a == null || b == null) return a == b;
        return Math.abs(a - b) < EPSILON;
    }

    private static void apply(AmcsCollection c, ParsedRow p) {
        c.setMemberCode(p.memberCode);
        c.setDate(p.date);
        c.setShift(p.shift);
        c.setSampleNo(p.sampleNo);
        c.setAnimalType(p.animalType);
        c.setQuantity(p.quantity);
        c.setFat(p.fat);
        c.setSnf(p.snf);
        c.setClr(p.clr);
        c.setRatePerLitre(p.rate);
        c.setAmount(p.amount);
        c.setQualityManual(p.qualityManual);
        c.setQuantityManual(p.quantityManual);
        c.setAmcsUpdatedBy(p.updatedBy);
        c.setAmcsUpdatedAt(p.updatedAt);
    }
}
