package com.dairy.service;

import com.dairy.model.RolePermission;
import com.dairy.model.User;
import com.dairy.repo.RolePermissionRepository;
import com.dairy.repo.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service("ss")
public class SecurityService {

    @Autowired
    private RolePermissionRepository rolePermissionRepository;

    @Autowired
    private UserRepository userRepository;

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

    /**
     * The signed-in user's permissions by module, for the app to show only what they can use.
     * ADMIN gets every module, matching the bypass in can().
     */
    public Map<String, Map<String, Boolean>> myPermissions(List<String> modules) {
        String role = currentRole();
        Map<String, Map<String, Boolean>> out = new LinkedHashMap<>();
        if ("ADMIN".equals(role)) {
            modules.forEach(m -> out.put(m, Map.of("view", true, "create", true, "edit", true, "delete", true)));
            return out;
        }
        for (RolePermission rp : rolePermissionRepository.findByRole(role)) {
            out.put(rp.getModuleName(), Map.of("view", rp.isCanView(), "create", rp.isCanCreate(),
                "edit", rp.isCanEdit(), "delete", rp.isCanDelete()));
        }
        return out;
    }

    /**
     * Whether the signed-in user is this staff member, for what everyone may see of their own
     * (their salary breakdown), whatever their role allows of others'.
     * Use in @PreAuthorize("@ss.isOwnStaff(#staffId)").
     */
    public boolean isOwnStaff(Long staffId) {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (staffId == null || auth == null) return false;
        return userRepository.findByEmail(auth.getName()).map(User::getStaffId).map(staffId::equals).orElse(false);
    }

    private String currentRole() {
        return SecurityContextHolder.getContext().getAuthentication()
                .getAuthorities().stream()
                .map(a -> a.getAuthority().replace("ROLE_", ""))
                .findFirst()
                .orElse("GUEST");
    }

}
