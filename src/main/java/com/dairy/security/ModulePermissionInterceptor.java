package com.dairy.security;

import com.dairy.model.User;
import com.dairy.repo.UserRepository;
import com.dairy.service.SecurityService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.io.IOException;
import java.util.Set;

/**
 * Applies role_permissions (the Roles tab under Staff Management) to every API route, by the
 * module table in ModuleAccessRules. Runs after sign-in, before the controller.
 *
 * ADMIN is never limited. CUSTOMER is not checked here: customers use the shop and their own
 * orders, which have their own rules. Every other role - STAFF, PARTNER, FINANCE and any added
 * later - gets exactly what is ticked for it.
 */
@Component
public class ModulePermissionInterceptor implements HandlerInterceptor {

    private static final Set<String> UNCHECKED_ROLES = Set.of("ADMIN", "CUSTOMER");

    @Autowired private SecurityService securityService;
    @Autowired private UserRepository userRepository;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws IOException {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) return true;
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) return true; // public routes; Spring Security guards the rest
        String role = auth.getAuthorities().stream()
            .map(a -> a.getAuthority().replace("ROLE_", ""))
            .findFirst().orElse("");
        if (role.isEmpty() || role.equals("ANONYMOUS") || UNCHECKED_ROLES.contains(role)) return true;

        String path = request.getRequestURI();
        Set<String> modules = ModuleAccessRules.modulesFor(request.getMethod(), path);
        if (modules.isEmpty()) return true;

        String action = ModuleAccessRules.actionFor(request.getMethod());
        for (String module : modules) {
            if (securityService.can(module, action)) return true;
        }
        if (isOwnStaffRecord(request.getMethod(), path, auth.getName())) return true;

        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType("application/json");
        response.getWriter().write("{\"message\":\"Access Denied\"}");
        return false;
    }

    /** Everyone may read their own staff profile (the sidebar shows it), whatever Staff Management allows. */
    private boolean isOwnStaffRecord(String method, String path, String email) {
        if (!"GET".equalsIgnoreCase(method) || !path.matches("/api/staff/\\d+")) return false;
        Long id = Long.valueOf(path.substring("/api/staff/".length()));
        return userRepository.findByEmail(email).map(User::getStaffId).map(id::equals).orElse(false);
    }
}
