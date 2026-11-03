package com.dairy.security;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Which role_permissions modules guard each API route, for ModulePermissionInterceptor.
 *
 * Writes need the action (POST create, PUT/PATCH edit, DELETE delete) in one of the route's write
 * modules - the module that owns the data. Reads need view in any module whose screens show that
 * data: the dashboard reads herds and milk records, the ledger lists herds for medical costs, and
 * so on, so un-ticking Herd Management hides that screen without breaking the others.
 *
 * Routes not listed here are not module-checked (sign-in, own profile, files, settings,
 * permissions). The longest matching prefix wins.
 */
public final class ModuleAccessRules {

    /** No module check for this kind of request. */
    public static final Set<String> OPEN = Set.of();

    public record Rule(String prefix, Set<String> readModules, Set<String> writeModules) {}

    private static final List<Rule> RULES = List.of(
        rule("/api/dashboard", Set.of("DASHBOARD"), Set.of("DASHBOARD")),
        rule("/api/reports", Set.of("DASHBOARD"), Set.of("DASHBOARD")),
        rule("/api/alerts", OPEN, OPEN),

        rule("/api/herds", Set.of("HERDS", "DASHBOARD", "PRODUCTION", "FEEDS", "ACTIVITIES", "INVENTORY", "LEDGER"), Set.of("HERDS")),
        // Weight and deworming rounds are run from Farm Chores as well as from the animal page.
        rule("/api/herds/weight", Set.of("HERDS", "ACTIVITIES"), Set.of("HERDS", "ACTIVITIES")),
        rule("/api/herds/deworming", Set.of("HERDS", "ACTIVITIES"), Set.of("HERDS", "ACTIVITIES")),
        rule("/api/onboarding", Set.of("HERDS", "ACTIVITIES"), Set.of("HERDS", "ACTIVITIES")),
        rule("/api/emergency-contacts", Set.of("HERDS", "ACTIVITIES"), Set.of("HERDS")),
        rule("/api/semen-catalog", Set.of("HERDS"), Set.of("HERDS")),
        rule("/api/breeds", Set.of("HERDS", "INVENTORY", "FEEDS"), Set.of("HERDS", "INVENTORY")),
        rule("/api/assets", Set.of("INVENTORY", "HERDS"), Set.of("INVENTORY", "HERDS")),

        rule("/api/milk-records", Set.of("PRODUCTION", "DASHBOARD"), Set.of("PRODUCTION")),
        rule("/api/milk-dispatch", Set.of("PRODUCTION"), Set.of("PRODUCTION")),
        rule("/api/production", Set.of("PRODUCTION"), Set.of("PRODUCTION")),
        rule("/api/amcs", Set.of("PRODUCTION"), Set.of("PRODUCTION")),

        rule("/api/feeds", Set.of("FEEDS"), Set.of("FEEDS")),
        rule("/api/feed-plans", Set.of("FEEDS"), Set.of("FEEDS")),
        rule("/api/animal-requirements", Set.of("FEEDS"), Set.of("FEEDS")),
        rule("/api/ration", Set.of("FEEDS"), Set.of("FEEDS")),

        rule("/api/activities", Set.of("ACTIVITIES"), Set.of("ACTIVITIES")),
        // Today's chores show as a banner on every farm screen.
        rule("/api/activities/today", OPEN, Set.of("ACTIVITIES")),

        rule("/api/inventory", Set.of("INVENTORY"), Set.of("INVENTORY")),
        rule("/api/store", Set.of("SHOP", "INVENTORY", "FEEDS"), Set.of("SHOP")),

        rule("/api/orders", Set.of("ORDERS"), Set.of("ORDERS")),
        // The customer catalogue: anyone reads it; managed under Shop, as the controllers already check.
        rule("/api/products", OPEN, Set.of("SHOP")),
        rule("/api/subscription-plans", OPEN, Set.of("SHOP")),
        rule("/api/customers", Set.of("SALES", "PRODUCTION", "HERDS", "ORDERS"), Set.of("SALES")),
        rule("/api/sales", Set.of("SALES", "HERDS"), Set.of("SALES")),

        rule("/api/expenses", Set.of("LEDGER", "DASHBOARD"), Set.of("LEDGER")),
        rule("/api/income", Set.of("LEDGER", "DASHBOARD"), Set.of("LEDGER")),
        rule("/api/categories", Set.of("LEDGER", "BANK", "HERDS"), Set.of("LEDGER")),
        rule("/api/purchases", Set.of("LEDGER"), Set.of("LEDGER")),
        rule("/api/bank", Set.of("BANK"), Set.of("BANK")),
        rule("/api/finance", Set.of("FINANCE"), Set.of("FINANCE")),
        rule("/api/audit-packages", Set.of("FINANCE"), Set.of("FINANCE")),

        rule("/api/staff", Set.of("STAFF", "LEDGER", "ACTIVITIES"), Set.of("STAFF"))
    ).stream().sorted(Comparator.comparingInt((Rule r) -> r.prefix().length()).reversed()).toList();

    private ModuleAccessRules() { }

    private static Rule rule(String prefix, Set<String> read, Set<String> write) {
        return new Rule(prefix, read, write);
    }

    /** The rule for this path, or null when the route is not module-checked. */
    public static Rule ruleFor(String path) {
        for (Rule r : RULES) {
            if (path.equals(r.prefix()) || path.startsWith(r.prefix() + "/")) return r;
        }
        return null;
    }

    /** GET/HEAD -> VIEW, POST -> CREATE, PUT/PATCH -> EDIT, DELETE -> DELETE. */
    public static String actionFor(String method) {
        return switch (method.toUpperCase(Locale.ROOT)) {
            case "POST" -> "CREATE";
            case "PUT", "PATCH" -> "EDIT";
            case "DELETE" -> "DELETE";
            default -> "VIEW";
        };
    }

    /** Modules any one of which grants this request; OPEN when there is nothing to check. */
    public static Set<String> modulesFor(String method, String path) {
        Rule r = ruleFor(path);
        if (r == null) return OPEN;
        return "VIEW".equals(actionFor(method)) ? r.readModules() : r.writeModules();
    }
}
