package com.dairy.config;

import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Keeps role_permissions covering every module for every staff-side role, and the users.role
 * column able to hold each Role.
 *
 * Only missing (role, module) rows are added - a permission changed in the table (or in
 * phpMyAdmin) is never overwritten. Safe on every start.
 */
@Component
public class RolePermissionMigration implements CommandLineRunner {

    /** Module names as checked by @ss.can(...) and the sidebar. */
    public static final List<String> MODULES = List.of("DASHBOARD", "HERDS", "PRODUCTION", "FEEDS", "ACTIVITIES",
        "INVENTORY", "SHOP", "ORDERS", "SALES", "LEDGER", "BANK", "FINANCE", "STAFF");

    /** Defaults for rows that do not exist yet: V(iew) C(reate) E(dit) D(elete), "-" for none. */
    private static final Map<String, Map<String, String>> DEFAULTS = new LinkedHashMap<>();
    static {
        Map<String, String> admin = new LinkedHashMap<>();
        MODULES.forEach(m -> admin.put(m, "VCED"));
        DEFAULTS.put("ADMIN", admin);

        // Farm owners' partners: everything, as the ADMIN/PARTNER checks elsewhere already assume.
        DEFAULTS.put("PARTNER", new LinkedHashMap<>(admin));

        // Staff keep what they had; the bank account and finance figures stay closed.
        Map<String, String> staff = new LinkedHashMap<>(admin);
        staff.put("DASHBOARD", "V");
        staff.put("ORDERS", "-");
        staff.put("BANK", "-");
        staff.put("FINANCE", "-");
        DEFAULTS.put("STAFF", staff);

        // Accounts: money in and out, read-only views of the business screens they reconcile against.
        Map<String, String> finance = new LinkedHashMap<>();
        MODULES.forEach(m -> finance.put(m, "-"));
        finance.put("DASHBOARD", "V");
        finance.put("INVENTORY", "V");
        finance.put("SHOP", "V");
        finance.put("ORDERS", "V");
        finance.put("SALES", "VCED");
        finance.put("LEDGER", "VCED");
        finance.put("BANK", "VCED");
        finance.put("FINANCE", "VCED");
        DEFAULTS.put("FINANCE", finance);
    }

    private final JdbcTemplate jdbcTemplate;

    public RolePermissionMigration(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(String... args) {
        addFinanceToUserRoles();
        addMissingPermissions();
    }

    /** users.role is a MySQL ENUM that Hibernate's ddl-auto never widens. */
    private void addFinanceToUserRoles() {
        try {
            String type = jdbcTemplate.queryForObject(
                "SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() "
                    + "AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role'", String.class);
            if (type != null && type.startsWith("enum(") && !type.contains("'FINANCE'")) {
                jdbcTemplate.execute("ALTER TABLE users MODIFY role "
                    + "ENUM('ADMIN','CUSTOMER','PARTNER','STAFF','FINANCE') NOT NULL");
                System.out.println(">>> users.role can now be FINANCE");
            }
        } catch (Exception e) {
            System.out.println(">>> INFO: users.role migration skipped: " + e.getMessage());
        }
    }

    private void addMissingPermissions() {
        try {
            int added = 0;
            for (Map.Entry<String, Map<String, String>> role : DEFAULTS.entrySet()) {
                for (Map.Entry<String, String> module : role.getValue().entrySet()) {
                    Integer exists = jdbcTemplate.queryForObject(
                        "SELECT COUNT(*) FROM role_permissions WHERE role = ? AND module_name = ?",
                        Integer.class, role.getKey(), module.getKey());
                    if (exists != null && exists > 0) continue;
                    String f = module.getValue();
                    jdbcTemplate.update("INSERT INTO role_permissions "
                            + "(role, module_name, can_view, can_create, can_edit, can_delete) VALUES (?, ?, ?, ?, ?, ?)",
                        role.getKey(), module.getKey(),
                        f.contains("V"), f.contains("C"), f.contains("E"), f.contains("D"));
                    added++;
                }
            }
            if (added > 0) System.out.println(">>> role_permissions: added " + added + " missing rows");
        } catch (Exception e) {
            System.out.println(">>> INFO: role_permissions migration skipped: " + e.getMessage());
        }
    }
}
