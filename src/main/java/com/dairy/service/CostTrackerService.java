package com.dairy.service;

import com.dairy.model.Asset;
import com.dairy.model.Expense;
import com.dairy.model.Herd;
import com.dairy.model.HerdEvent;
import com.dairy.repo.AssetRepository;
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
            {"LABOUR", "Salary", "salary,labour,labor,wage,staff"},
            {"BROKERAGE", "Brokerage", "commission,broker"},
            {"ANIMALS", "Animal purchase", "poultry,cow purchase,calf purchase,animal"},
            {"INFRA", "Infrastructure & equipment", "suppl,machiner,repair,pesticide,contract,equipment,electric,plumb,construct,shed,tool"},
            {"TRANSPORT", "Transport & fuel", "transport,fuel,diesel,petrol,vehicle"},
            {"OTHER", "Other", ""},
    };

    /** Group for expenses marked unaccounted, when a report asks for them. */
    static final String UNACCOUNTED = "UNACCOUNTED";

    private static final Set<String> BATCH_TYPES = Set.of("CHICKEN", "DUCK", "FISH", "QUAIL");

    @Autowired
    private ExpenseRepository expenseRepository;

    @Autowired
    private HerdEventRepository eventRepository;

    @Autowired
    private HerdRepository herdRepository;

    @Autowired
    private AssetRepository assetRepository;

    /** Asset categories that are animals bought for the herd. */
    static final Set<String> CATTLE_ASSET_CATEGORIES = Set.of("cow", "calf", "heifer", "buffalo", "bull");

    /**
     * Cattle bought in the range, from the asset register (registering a bought cow records her
     * purchase cost there, not in the ledger), by purchase date. Disposed animals count too: the
     * money was spent. This is investment, so it is kept apart from the expense entries.
     */
    public List<Map<String, Object>> cattlePurchases(LocalDate from, LocalDate to) {
        // A cow's asset carries her tag as its serial number; that ties the purchase to her herd record.
        Map<String, Herd> herdByTag = new HashMap<>();
        for (Herd h : herdRepository.findAll()) {
            if (h.getTagNumber() != null) herdByTag.put(h.getTagNumber().trim(), h);
        }
        List<Map<String, Object>> out = new ArrayList<>();
        for (Asset a : assetRepository.findAll()) {
            if (a.getCategory() == null || !CATTLE_ASSET_CATEGORIES.contains(a.getCategory().trim().toLowerCase())) continue;
            if (a.getPurchaseDate() == null || a.getPurchaseDate().isBefore(from) || a.getPurchaseDate().isAfter(to)) continue;
            if (a.getValue() == null || a.getValue() <= 0) continue;
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", a.getId());
            m.put("name", a.getName() == null ? "" : a.getName().trim());
            m.put("date", a.getPurchaseDate());
            m.put("amount", a.getValue());
            m.put("status", a.getStatus());
            Herd herd = a.getSerialNumber() == null ? null : herdByTag.get(a.getSerialNumber().trim());
            m.put("herdId", herd != null ? herd.getId() : null);
            m.put("animalName", herd != null && herd.getAnimalName() != null ? herd.getAnimalName().trim() : null);
            out.add(m);
        }
        out.sort(Comparator.comparing((Map<String, Object> m) -> (LocalDate) m.get("date")).reversed());
        return out;
    }

    public Map<String, Object> summary(LocalDate from, LocalDate to, String segment) {
        return summary(from, to, segment, false);
    }

    /**
     * With {@code includeUnaccounted}, expenses marked unaccounted (paid outside the farm's books) are
     * returned too, in their own UNACCOUNTED group, so a report can show them beside the rest. The
     * previous-period comparison never includes them.
     */
    public Map<String, Object> summary(LocalDate from, LocalDate to, String segment, boolean includeUnaccounted) {
        String seg = segment == null ? "ALL" : segment.toUpperCase();
        Map<Long, Herd> batches = new HashMap<>();
        for (Herd h : herdRepository.findAll()) {
            if (h.getAnimalType() != null && BATCH_TYPES.contains(h.getAnimalType().toUpperCase())) batches.put(h.getId(), h);
        }

        List<Map<String, Object>> entries = entries(from, to, seg, batches, includeUnaccounted);
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
        for (Map<String, Object> e : entries(prevFrom, prevTo, seg, batches, false)) {
            prevByGroup.merge((String) e.get("group"), (Double) e.get("amount"), Double::sum);
        }

        List<Map<String, Object>> groups = new ArrayList<>();
        for (String[] g : GROUPS) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("key", g[0]);
            m.put("label", g[1]);
            groups.add(m);
        }
        if (includeUnaccounted) groups.add(Map.of("key", UNACCOUNTED, "label", "Unaccounted"));

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

    private List<Map<String, Object>> entries(LocalDate from, LocalDate to, String seg, Map<Long, Herd> batches,
                                              boolean includeUnaccounted) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Expense x : expenseRepository.findByDateBetween(from, to)) {
            if (x.getAmount() == null) continue;
            if (x.isUnaccounted() && !includeUnaccounted) continue; // paid outside the farm's books
            String category = x.getCategory() == null ? "" : x.getCategory().trim();
            boolean poultry = "POULTRY".equalsIgnoreCase(x.getSegment())
                    || "poultry".equalsIgnoreCase(category)
                    || (x.getHerdId() != null && batches.containsKey(x.getHerdId()));
            if (!inSegment(seg, poultry)) continue;
            Map<String, Object> e = new LinkedHashMap<>();
            e.put("id", x.getId());
            e.put("date", x.getDate());
            e.put("category", category);
            e.put("group", x.isUnaccounted() ? UNACCOUNTED : groupOf(category));
            e.put("amount", x.getAmount());
            e.put("description", x.getDescription());
            e.put("segment", poultry ? "POULTRY" : "CATTLE");
            e.put("source", "EXPENSE");
            e.put("herdId", x.getHerdId());
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
