package com.dairy.controller;

import com.dairy.model.Customer;
import com.dairy.service.CustomerPortalService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.Map;

/** The signed-in customer's own milk deliveries. Only ever their own: the customer comes from the login. */
@RestController
@RequestMapping("/api/my/milk")
public class MyMilkController {

    @Autowired
    private CustomerPortalService portalService;

    /** GET /api/my/milk?from=2026-11-01&to=2026-11-30 (defaults to this month so far). */
    @GetMapping
    public Map<String, Object> statement(
            Authentication auth,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return portalService.statementFor(portalService.currentCustomer(auth.getName()), from, to);
    }
}
