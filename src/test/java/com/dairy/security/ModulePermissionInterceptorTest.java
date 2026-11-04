package com.dairy.security;

import com.dairy.model.User;
import com.dairy.repo.UserRepository;
import com.dairy.service.SecurityService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * The Roles tab must really limit staff-side users: writes need the owning module's right,
 * reads need view on a screen that shows the data, and admins and customers are not touched.
 */
class ModulePermissionInterceptorTest {

    private ModulePermissionInterceptor interceptor;
    private SecurityService securityService;
    private UserRepository userRepository;
    /** role|MODULE|ACTION granted to the current user. */
    private final Set<String> granted = new HashSet<>();
    private String role;

    @BeforeEach
    void setUp() {
        interceptor = new ModulePermissionInterceptor();
        securityService = mock(SecurityService.class);
        userRepository = mock(UserRepository.class);
        when(securityService.can(anyString(), anyString()))
            .thenAnswer(inv -> granted.contains(inv.getArgument(0) + "|" + inv.getArgument(1)));
        ReflectionTestUtils.setField(interceptor, "securityService", securityService);
        ReflectionTestUtils.setField(interceptor, "userRepository", userRepository);
    }

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    private void signIn(String role, String... rights) {
        this.role = role;
        granted.clear();
        granted.addAll(Arrays.asList(rights));
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
            "sara@farm.com", null, List.of(new SimpleGrantedAuthority("ROLE_" + role))));
    }

    private int call(String method, String path) throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest(method, path);
        MockHttpServletResponse res = new MockHttpServletResponse();
        return interceptor.preHandle(req, res, new Object()) ? 200 : res.getStatus();
    }

    @Test
    void financeWorksTheBooksButCannotTouchTheHerd() throws Exception {
        signIn("FINANCE", "DASHBOARD|VIEW", "LEDGER|VIEW", "LEDGER|CREATE", "BANK|VIEW", "BANK|CREATE", "SHOP|VIEW");

        assertEquals(200, call("POST", "/api/expenses"));
        assertEquals(200, call("POST", "/api/bank/import"));
        assertEquals(200, call("GET", "/api/store/sales"));
        assertEquals(403, call("POST", "/api/store/sales"));
        assertEquals(403, call("POST", "/api/herds"));
        assertEquals(403, call("GET", "/api/milk-dispatch/by-date"));
        assertEquals(403, call("GET", "/api/feeds"));
        assertEquals(403, call("GET", "/api/activities/templates"));
    }

    @Test
    void readsSharedByAScreenTheRoleCanSeeStayOpen() throws Exception {
        signIn("FINANCE", "DASHBOARD|VIEW", "LEDGER|VIEW");

        assertEquals(200, call("GET", "/api/herds"), "dashboard and ledger list the herd");
        assertEquals(200, call("GET", "/api/milk-records/summary"), "dashboard shows milk");
        assertEquals(200, call("GET", "/api/activities/today"), "the chore banner is on every screen");
        assertEquals(200, call("GET", "/api/categories"));
        assertEquals(403, call("PUT", "/api/herds/5"), "reading for the dashboard is not editing");
    }

    @Test
    void untickingViewClosesTheModulesOwnScreen() throws Exception {
        signIn("STAFF", "HERDS|VIEW", "HERDS|CREATE", "PRODUCTION|VIEW");

        assertEquals(200, call("GET", "/api/herds"));
        assertEquals(403, call("GET", "/api/bank/status"));
        assertEquals(403, call("GET", "/api/staff"));
        assertEquals(200, call("POST", "/api/herds/weight/rounds"), "weight rounds belong to herds or chores");
        assertEquals(403, call("DELETE", "/api/herds/5"));
    }

    @Test
    void everyoneReadsTheirOwnStaffProfile() throws Exception {
        signIn("FINANCE", "DASHBOARD|VIEW");
        User sara = new User();
        sara.setStaffId(4L);
        when(userRepository.findByEmail("sara@farm.com")).thenReturn(Optional.of(sara));

        assertEquals(200, call("GET", "/api/staff/4"));
        assertEquals(403, call("GET", "/api/staff/5"));
    }

    @Test
    void staffReadTheirOwnSalaryButNotTheBank() throws Exception {
        signIn("STAFF", "STAFF|VIEW");
        when(securityService.isOwnStaff(1L)).thenReturn(true);

        assertEquals(200, call("GET", "/api/bank/salary-rules/1/breakdown"), "their own salary");
        assertEquals(403, call("GET", "/api/bank/salary-rules/2/breakdown"), "someone else's");
        assertEquals(403, call("GET", "/api/bank/salary-rules"), "every rule is still Bank's");
        assertEquals(403, call("GET", "/api/bank/salary-rules/calculate"));
        assertEquals(403, call("PUT", "/api/bank/salary-rules/1/breakdown"), "reading only");
    }

    @Test
    void adminsAndCustomersAreNotModuleChecked() throws Exception {
        signIn("ADMIN");
        assertEquals(200, call("DELETE", "/api/bank/rules/1"));
        signIn("CUSTOMER");
        assertEquals(200, call("POST", "/api/orders/checkout-flow"));
        verifyNoInteractions(securityService);
    }

    @Test
    void routesOutsideTheModulesAreLeftAlone() throws Exception {
        signIn("FINANCE");
        assertEquals(200, call("GET", "/api/users/me"));
        assertEquals(200, call("GET", "/api/permissions/me"));
        assertEquals(200, call("POST", "/api/files/upload"));
        assertEquals(200, call("GET", "/api/products"));
    }

    @Test
    void longestPrefixWinsAndPrefixesMatchWholeSegments() {
        assertEquals("/api/herds/weight", ModuleAccessRules.ruleFor("/api/herds/weight/rounds").prefix());
        assertEquals("/api/herds", ModuleAccessRules.ruleFor("/api/herds/12/events").prefix());
        assertEquals("/api/feeds", ModuleAccessRules.ruleFor("/api/feeds/optimize").prefix());
        assertNull(ModuleAccessRules.ruleFor("/api/herdsman"));
        assertEquals("EDIT", ModuleAccessRules.actionFor("PATCH"));
    }
}
