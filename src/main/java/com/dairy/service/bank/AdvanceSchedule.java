package com.dairy.service.bank;

import com.dairy.model.bank.SalaryAdvance;

import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * An employee's advance account month by month.
 *
 * Each month, in this order: advances given that month add to what is owed; repayments that
 * month take off it; then the cut is the planned instalments of every advance due that month
 * (amount / terms, the last taking what is left so they add up exactly), but never more than is
 * still owed. So a repayment ends the cuts early and a new advance adds its own instalments.
 */
public final class AdvanceSchedule {

    /** One month of the account. All amounts in whole rupees. */
    public record Month(YearMonth month, long given, long repaid, long planned, long cut, long left) {}

    private AdvanceSchedule() { }

    /** Months from the first entry until the account is clear and no instalments remain, and at least through `until`. */
    public static List<Month> build(List<SalaryAdvance> entries, YearMonth until) {
        List<Month> out = new ArrayList<>();
        if (entries.isEmpty()) return out;
        YearMonth first = entries.stream().map(e -> YearMonth.from(e.getDate())).min(Comparator.naturalOrder()).get();
        YearMonth lastPlanned = entries.stream()
            .filter(e -> "GIVEN".equals(e.getType()) && e.getStartMonth() != null && e.getTerms() != null)
            .map(e -> YearMonth.parse(e.getStartMonth()).plusMonths(e.getTerms() - 1L))
            .max(Comparator.naturalOrder()).orElse(first);
        YearMonth end = until.isAfter(lastPlanned) ? until : lastPlanned;

        long owed = 0;
        for (YearMonth m = first; !m.isAfter(end); m = m.plusMonths(1)) {
            long given = 0, repaid = 0, planned = 0;
            for (SalaryAdvance e : entries) {
                long amount = Math.round(e.getAmount());
                if ("GIVEN".equals(e.getType())) {
                    if (YearMonth.from(e.getDate()).equals(m)) given += amount;
                    planned += instalment(e, m);
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

    /** What this advance plans to take in month m. */
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
