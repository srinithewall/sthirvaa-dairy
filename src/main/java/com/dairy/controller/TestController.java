package com.dairy.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/test")
public class TestController {

    @GetMapping("/ping")
    public String ping() {
        return "SUCCESS - Dairy Backend is Alive";
    }

    @GetMapping("/test/ping")
    public String testPing() {
        return "PONG - Security Version 2.0 (Nuclear)";
    }
}
