package com.dairy.service;

import com.dairy.model.Expense;
import com.dairy.model.Herd;
import com.dairy.model.HerdEvent;
import com.dairy.repo.ExpenseRepository;
import com.dairy.repo.HerdEventRepository;
import com.dairy.repo.HerdRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Cost tracker: every farm cost in a date range, sorted into cost parameters (feed, vet, deaths ...).
 *
 *   - Ledger expenses: the parameter comes from the expense category name (keywords below), so new
 *     categories created in the ledger fall into the right parameter without any setup; anything that
 *     matches nothing is "Other".
 *   - Poultry deaths (BIRD_DEATH events) are a loss even though no money is paid: birds died x the
 *     batch's cost per bird. Cattle deaths are booked in the ledger ("Cattle expired") and land in the
 *     same parameter through its keywords.
 *   - Segment: an expense is poultry when it is tagged POULTRY, its category is "Poultry", or it is
 *     linked to a poultry batch; everything else is cattle (same rule as the ledger page).
 *   - The previous period, for the comparison: a range starting on the 1st is shifted back by its number of
 *     months (1-30 Oct -> 1-30 Sep, Aug-Oct -> May-Jul); any other range by its number of days.
 */
@Service
public class CostTrackerService {

    /** In display order. Keywords are matched against the lower-cased category; first match wins. */
    static final String[][] GROUPS = {
            {"FEED", "Feed & fodder", "feed,fodder,mineral,silage,hay,straw,concentrate,grass,calcium,bran,cake"},
            {"VET", "Vet & medical", "medic,doctor,vet,insemin,semen,vaccin,deworm,treatment,tablet,injection"},
            {"DEATHS", "Deaths & losses", "expire,death,dead,died,mortal,loss"},
            {"LABOUR", "Labour & salary", "salary,labour,labor,wage,staff"},
            {"ANIMALS", "Animal purchase", "poultry,commission,broker,cow purchase,calf purchase,animal"},
            {"INFRA", "Infrastructure & equipment", "suppl,machiner,repair,pesticide,contract,equipment,electric,plumb,construct,shed,tool"},
            {"TRANSPORT", "Transport & fuel", "transport,fuel,diesel,petrol,vehicle"},
            {"OTHER", "Other", ""},
    };

    private static final Set<String> BATCH_TYPES = Set.of("CHICKEN", "DUCK", "FISH", "QUAIL");

    @Autowired
    private ExpenseRepository expenseRepository;

    @Autowired
    private HerdEventRepository eventRepository;

    @Autowired
    private HerdRepository herdRepository;

    public Map<String, Object> summary(LocalDate from, LocalDate to, String segment) {
        String seg = segment == null ? "ALL" : segment.toUpperCase();
        Map<Long, Herd> batches = new HashMap<>();
        for (Herd h : herdRepository.findAll()) {
            if (h.getAnimalType() != null && BATCH_TYPES.contains(h.getAnimalType().toUpperCase())) batches.put(h.getId(), h);
        }

        List<Map<String, Object>> entries = entries(from, to, seg, batches);
        LocalDate prevFrom, prevTo;
        if (from.getDayOfMonth() == 1) {
            long months = ChronoUnit.MONTHS.between(YearMonth.from(from), YearMonth.from(to)) + 1;
            prevFrom = from.minusMonths(months);
            prevTo = to.minusMonths(months);
        } else {
            long days = ChronoUnit.DAYS.between(from, to) + 1;
            prevTo = from.minusDays(1);
            prevFrom = prevTo.minusDays(days - 1);
        }
        Map<String, Double> prevByGroup = new LinkedHashMap<>();
        for (String[] g : GROUPS) prevByGroup.put(g[0], 0.0);
        for (Map<String, Object> e : entries(prevFrom, prevTo, seg, batches)) {
            prevByGroup.merge((String) e.get("group"), (Double) e.get("amount"), Double::sum);
        }

        List<Map<String, Object>> groups = new ArrayList<>();
        for (String[] g : GROUPS) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("key", g[0]);
            m.put("label", g[1]);
            groups.add(m);
        }

        Map<String, Object> previous = new LinkedHashMap<>();
        previous.put("from", prevFrom);
        previous.put("to", prevTo);
        previous.put("byGroup", prevByGroup);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("from", from);
        out.put("to", to);
        out.put("segment", seg);
        out.put("groups", groups);
        out.put("entries", entries);
        out.put("previous", previous);
        return out;
    }

    private List<Map<String, Object>> entries(LocalDate from, LocalDate to, String seg, Map<Long, Herd> batches) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Expense x : expenseRepository.findByDateBetween(from, to)) {
            if (x.getAmount() == null) continue;
            String category = x.getCategory() == null ? "" : x.getCategory().trim();
            boolean poultry = "POULTRY".equalsIgnoreCase(x.getSegment())
                    || "poultry".equalsIgnoreCase(category)
                    || (x.getHerdId() != null && batches.containsKey(x.getHerdId()));
            if (!inSegment(seg, poultry)) continue;
            Map<String, Object> e = new LinkedHashMap<>();
            e.put("id", x.getId());
            e.put("date", x.getDate());
            e.put("category", category);
            e.put("group", groupOf(category));
            e.put("amount", x.getAmount());
            e.put("description", x.getDescription());
            e.put("segment", poultry ? "POULTRY" : "CATTLE");
            e.put("source", "EXPENSE");
            out.add(e);
        }

        if (inSegment(seg, true)) {
            for (HerdEvent ev : eventRepository.findByEventTypeAndEventDateBetween("BIRD_DEATH", from, to)) {
                Herd batch = batches.get(ev.getHerdId());
                int died = ev.getQuantity() == null ? 0 : ev.getQuantity();
                if (batch == null || died <= 0) continue;
                double each = batch.getCostPerBird() == null ? 0 : batch.getCostPerBird();
                String type = batch.getAnimalType().toUpperCase();
                String unit = "FISH".equals(type) ? "fish" : "birds";
                Map<String, Object> e = new LinkedHashMap<>();
                e.put("id", ev.getId());
                e.put("date", ev.getEventDate());
                e.put("category", "Poultry deaths");
                e.put("group", "DEATHS");
                e.put("amount", died * each);
                e.put("description", died + " " + unit + " died - " + label(batch)
                        + (each > 0 ? " @ " + Math.round(each) + " each" : " (no cost per bird set)"));
                e.put("segment", "POULTRY");
                e.put("source", "BIRD_DEATH");
                e.put("quantity", died);
                out.add(e);
            }
        }

        out.sort((a, b) -> ((LocalDate) b.get("date")).compareTo((LocalDate) a.get("date")));
        return out;
    }

    private static boolean inSegment(String seg, boolean poultry) {
        return "ALL".equals(seg) || ("POULTRY".equals(seg) == poultry);
    }

    private static String label(Herd h) {
        String name = h.getAnimalName();
        return name != null && !name.isBlank() ? name + " (" + h.getTagNumber() + ")" : h.getTagNumber();
    }

    static String groupOf(String category) {
        String c = category.toLowerCase();
        if (c.equals("ai") || c.startsWith("ai ")) return "VET";
        for (String[] g : GROUPS) {
            for (String k : g[2].split(",")) {
                if (!k.isEmpty() && c.contains(k)) return g[0];
            }
        }
        return "OTHER";
    }
}
