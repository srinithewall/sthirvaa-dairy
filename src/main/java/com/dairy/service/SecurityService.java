package com.dairy.service;

import com.dairy.model.RolePermission;
import com.dairy.repo.RolePermissionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

@Service("ss")
public class SecurityService {

    @Autowired
    private RolePermissionRepository rolePermissionRepository;

    /**
     * Checks if the current authenticated user has access to a module with a specific action.
     * Use in @PreAuthorize("@ss.can('SHOP', 'EDIT')")
     */
    public boolean can(String module, String action) {
        String currentRole = SecurityContextHolder.getContext().getAuthentication()
                .getAuthorities().stream()
                .map(a -> a.getAuthority().replace("ROLE_", ""))
                .findFirst()
                .orElse("GUEST");

        // ADMIN has full access bypass
        if ("ADMIN".equals(currentRole)) {
            return true;
        }

        return rolePermissionRepository.findByRoleAndModuleName(currentRole, module.toUpperCase().trim())
                .map(rp -> {
                    boolean hasPermission = false;
                    switch (action.toUpperCase()) {
                        case "CREATE": hasPermission = rp.isCanCreate(); break;
                        case "EDIT": hasPermission = rp.isCanEdit(); break;
                        case "DELETE": hasPermission = rp.isCanDelete(); break;
                        case "VIEW": 
                        default: hasPermission = rp.isCanView(); break;
                    }
                    return hasPermission;
                })
                .orElse(false);
    }

    /**
     * Legacy support for single argument check (defaults to VIEW)
     */
    public boolean can(String module) {
        return can(module, "VIEW");
    }

}
