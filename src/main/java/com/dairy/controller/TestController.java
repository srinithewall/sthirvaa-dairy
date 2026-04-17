package com.dairy.controller;

import com.dairy.service.SampleDataInitializer;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/test")
public class TestController {

    @Autowired
    private SampleDataInitializer sampleDataInitializer;

    @GetMapping("/seed")
    public String seedData() {
        try {
            sampleDataInitializer.run();
            return "Sample data seeding triggered successfully! Check your database now.";
        } catch (Exception e) {
            return "Error seeding data: " + e.getMessage();
        }
    }
}
