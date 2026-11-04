package com.dairy.service.bank;

import com.dairy.model.bank.SalaryAdvance;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * An employee's advance account month by month.
 *
 * Each month, in this order: advances given that month add to what is owed; repayments that
 * month take off it; then the cut is what every advance plans to take that month (its own
 * month-by-month plan, or for older advances amount / terms with the last taking what is left),
 * but never more than is still owed. So a repayment ends the cuts early and a new advance adds its own instalments.
 */
public final class AdvanceSchedule {

    /** One month of the account. All amounts in whole rupees. */
    public record Month(YearMonth month, long given, long repaid, long planned, long cut, long left) {}

    private static final ObjectMapper JSON = new ObjectMapper();

    private AdvanceSchedule() { }

    /** Months from the first entry until the account is clear and no instalments remain, and at least through `until`. */
    public static List<Month> build(List<SalaryAdvance> entries, YearMonth until) {
        List<Month> out = new ArrayList<>();
        if (entries.isEmpty()) return out;
        YearMonth first = entries.stream().map(e -> YearMonth.from(e.getDate())).min(Comparator.naturalOrder()).get();
        YearMonth lastPlanned = entries.stream()
            .filter(e -> "GIVEN".equals(e.getType()))
            .map(e -> plan(e).keySet().stream().max(Comparator.naturalOrder()).orElse(null))
            .filter(java.util.Objects::nonNull)
            .max(Comparator.naturalOrder()).orElse(first);
        YearMonth end = until.isAfter(lastPlanned) ? until : lastPlanned;

        Map<SalaryAdvance, Map<YearMonth, Long>> plans = new java.util.IdentityHashMap<>();
        for (SalaryAdvance e : entries) if ("GIVEN".equals(e.getType())) plans.put(e, plan(e));

        long owed = 0;
        for (YearMonth m = first; !m.isAfter(end); m = m.plusMonths(1)) {
            long given = 0, repaid = 0, planned = 0;
            for (SalaryAdvance e : entries) {
                long amount = Math.round(e.getAmount());
                if ("GIVEN".equals(e.getType())) {
                    if (YearMonth.from(e.getDate()).equals(m)) given += amount;
                    planned += plans.get(e).getOrDefault(m, 0L);
                } else if ("REPAID".equals(e.getType()) && YearMonth.from(e.getDate()).equals(m)) {
                    repaid += amount;
                }
            }
            owed += given;
            repaid = Math.min(repaid, owed); // paying back more than is owed is not an advance
            owed -= repaid;
            long cut = Math.min(planned, owed);
            owed -= cut;
            out.add(new Month(m, given, repaid, planned, cut, owed));
        }
        return out;
    }

    /** What this advance plans to take each month: its saved plan, or equal cuts over its terms. */
    public static Map<YearMonth, Long> plan(SalaryAdvance e) {
        Map<YearMonth, Long> out = new TreeMap<>();
        if (e.getCutPlan() != null && !e.getCutPlan().isBlank()) {
            try {
                Map<String, Number> saved = JSON.readValue(e.getCutPlan(), new TypeReference<Map<String, Number>>() { });
                saved.forEach((k, v) -> out.put(YearMonth.parse(k), Math.round(v.doubleValue())));
                return out;
            } catch (JsonProcessingException | RuntimeException ex) {
                // unreadable plan: fall back to equal cuts below
            }
        }
        if (e.getStartMonth() == null || e.getTerms() == null || e.getTerms() <= 0) return out;
        YearMonth start = YearMonth.parse(e.getStartMonth());
        for (int i = 0; i < e.getTerms(); i++) out.put(start.plusMonths(i), instalment(e, start.plusMonths(i)));
        return out;
    }

    /** The plan as saved: JSON {"YYYY-MM": amount} in month order. */
    public static String planJson(Map<YearMonth, Long> plan) {
        Map<String, Long> out = new java.util.LinkedHashMap<>();
        new TreeMap<>(plan).forEach((k, v) -> out.put(k.toString(), v));
        try {
            return JSON.writeValueAsString(out);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException(ex);
        }
    }

    /** Equal cuts of amount over terms months from start, the last taking what is left. */
    public static Map<YearMonth, Long> equalPlan(long amount, int terms, YearMonth start) {
        Map<YearMonth, Long> out = new TreeMap<>();
        long each = Math.round((double) amount / terms);
        for (int i = 0; i < terms; i++) out.put(start.plusMonths(i), i == terms - 1 ? amount - each * (terms - 1) : each);
        return out;
    }

    /** Equal-cut instalment of an advance without a saved plan, for month m. */
    static long instalment(SalaryAdvance e, YearMonth m) {
        if (e.getStartMonth() == null || e.getTerms() == null || e.getTerms() <= 0) return 0;
        long amount = Math.round(e.getAmount());
        int terms = e.getTerms();
        long index = ChronoUnit.MONTHS.between(YearMonth.parse(e.getStartMonth()), m);
        if (index < 0 || index >= terms) return 0;
        long each = Math.round((double) amount / terms);
        return index == terms - 1 ? amount - each * (terms - 1) : each;
    }

    /** The row for month m, or an empty one if the account had nothing in it then. */
    public static Month at(List<Month> rows, YearMonth m) {
        for (Month r : rows) if (r.month().equals(m)) return r;
        long left = 0;
        for (Month r : rows) if (r.month().isBefore(m)) left = r.left();
        return new Month(m, 0, 0, 0, 0, left);
    }
}
