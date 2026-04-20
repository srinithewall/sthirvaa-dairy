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
     * Checks if the current authenticated user has access to a module.
     * Use in @PreAuthorize("@ss.can('SALES')")
     */
    public boolean can(String module) {
        String currentRole = SecurityContextHolder.getContext().getAuthentication()
                .getAuthorities().stream()
                .map(a -> a.getAuthority().replace("ROLE_", ""))
                .findFirst()
                .orElse("GUEST");

        // If its ADMIN, we usually allow everything as a fallback, 
        // but lets strictly check the table as requested.
        return rolePermissionRepository.findByRoleAndModuleName(currentRole, module)
                .map(RolePermission::isCanView)
                .orElse(false);
    }
}
