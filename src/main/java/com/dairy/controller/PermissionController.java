package com.dairy.controller;

import com.dairy.config.RolePermissionMigration;
import com.dairy.model.Role;
import com.dairy.model.RolePermission;
import com.dairy.repo.RolePermissionRepository;
import com.dairy.service.SecurityService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * role_permissions: what each role may do in each module.
 * /me is for every signed-in user (the app hides what they cannot use); the matrix and its
 * changes are ADMIN only. ADMIN itself is never stored or edited - it always has everything.
 */
@RestController
@RequestMapping("/api/permissions")
public class PermissionController {

    /** Staff-side roles an admin can configure. CUSTOMER uses the shop, not these modules. */
    private static final List<String> ROLES = Arrays.stream(Role.values())
        .map(Role::name)
        .filter(r -> !r.equals("ADMIN") && !r.equals("CUSTOMER"))
        .toList();

    @Autowired
    private SecurityService securityService;

    @Autowired
    private RolePermissionRepository rolePermissionRepository;

    @GetMapping("/me")
    public Map<String, Map<String, Boolean>> mine() {
        return securityService.myPermissions(RolePermissionMigration.MODULES);
    }

    /** Every configurable role x every module; a missing row reads as no access. */
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping
    public Map<String, Object> matrix() {
        Map<String, RolePermission> stored = new HashMap<>();
        for (RolePermission rp : rolePermissionRepository.findAll()) {
            stored.put(rp.getRole() + "|" + rp.getModuleName(), rp);
        }
        List<Map<String, Object>> rows = new ArrayList<>();
        for (String role : ROLES) {
            for (String module : RolePermissionMigration.MODULES) {
                RolePermission rp = stored.get(role + "|" + module);
                rows.add(row(role, module, rp != null && rp.isCanView(), rp != null && rp.isCanCreate(),
                    rp != null && rp.isCanEdit(), rp != null && rp.isCanDelete()));
            }
        }
        return Map.of("roles", ROLES, "modules", RolePermissionMigration.MODULES, "rows", rows);
    }

    /**
     * Saves the ticked boxes. Body: [{role, module, view, create, edit, delete}, ...] - only the
     * rows sent are touched. Create, edit or delete without view is stored as view too.
     */
    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping
    @Transactional
    public Map<String, Object> save(@RequestBody List<Map<String, Object>> changes) {
        List<RolePermission> toSave = new ArrayList<>();
        for (Map<String, Object> c : changes) {
            String role = String.valueOf(c.get("role")).trim().toUpperCase(Locale.ROOT);
            String module = String.valueOf(c.get("module")).trim().toUpperCase(Locale.ROOT);
            if (!ROLES.contains(role)) throw new IllegalArgumentException("Role " + role + " cannot be changed");
            if (!RolePermissionMigration.MODULES.contains(module)) throw new IllegalArgumentException("Unknown module " + module);

            boolean create = Boolean.TRUE.equals(c.get("create"));
            boolean edit = Boolean.TRUE.equals(c.get("edit"));
            boolean delete = Boolean.TRUE.equals(c.get("delete"));
            boolean view = Boolean.TRUE.equals(c.get("view")) || create || edit || delete;

            RolePermission rp = rolePermissionRepository.findByRole(role).stream()
                .filter(p -> p.getModuleName().equals(module))
                .findFirst()
                .orElseGet(() -> {
                    RolePermission p = new RolePermission();
                    p.setRole(role);
                    p.setModuleName(module);
                    return p;
                });
            rp.setCanView(view);
            rp.setCanCreate(create);
            rp.setCanEdit(edit);
            rp.setCanDelete(delete);
            toSave.add(rp);
        }
        rolePermissionRepository.saveAll(toSave); // evicts the cached decisions at once
        return Map.of("saved", toSave.size());
    }

    private static Map<String, Object> row(String role, String module, boolean view, boolean create,
                                           boolean edit, boolean delete) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("role", role);
        m.put("module", module);
        m.put("view", view);
        m.put("create", create);
        m.put("edit", edit);
        m.put("delete", delete);
        return m;
    }
}
