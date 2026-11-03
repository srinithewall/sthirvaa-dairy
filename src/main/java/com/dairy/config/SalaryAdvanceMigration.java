package com.dairy.config;

import com.dairy.service.bank.SalaryRuleService;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

/** Moves the one advance older salary rules held into the advance list. Does nothing once moved. */
@Component
public class SalaryAdvanceMigration implements CommandLineRunner {

    private final SalaryRuleService salaryRuleService;

    public SalaryAdvanceMigration(SalaryRuleService salaryRuleService) {
        this.salaryRuleService = salaryRuleService;
    }

    @Override
    public void run(String... args) {
        try {
            int moved = salaryRuleService.moveRuleAdvancesToList();
            if (moved > 0) System.out.println(">>> salary advances: moved " + moved + " into the advance list");
        } catch (Exception e) {
            System.out.println(">>> INFO: salary advance move skipped: " + e.getMessage());
        }
    }
}
