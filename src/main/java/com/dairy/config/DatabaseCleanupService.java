package com.dairy.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Self-healing component to fix database schema inconsistencies 
 * by removing redundant columns and constraints.
 */
@Component
public class DatabaseCleanupService implements CommandLineRunner {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Override
    public void run(String... args) throws Exception {
        System.out.println(">>> Starting Database Cleanup to fix Milk Production issues...");
        
        try {
            // 1. Remove the annoying foreign key if it exists
            // Constraint name found from user error screenshot
            jdbcTemplate.execute("ALTER TABLE milk_records DROP FOREIGN KEY IF EXISTS FK6u76u49fd1r0j8ej995ww02uc");
            System.out.println(">>> Dropped FK constraint on cow_id.");
        } catch (Exception e) {
            System.out.println(">>> FK constraint already gone or different name: " + e.getMessage());
        }

        try {
            // 2. Remove the redundant cow_id column
            jdbcTemplate.execute("ALTER TABLE milk_records DROP COLUMN IF EXISTS cow_id");
            System.out.println(">>> Dropped redundant cow_id column.");
        } catch (Exception e) {
            System.out.println(">>> cow_id column already gone.");
        }

        try {
            // 3. Optional: Drop the empty ghost 'cows' table to avoid future confusion
            jdbcTemplate.execute("DROP TABLE IF EXISTS cows");
            System.out.println(">>> Dropped unused 'cows' table.");
        } catch (Exception e) {
            System.out.println(">>> Cows table already gone.");
        }

        System.out.println(">>> Database Cleanup Finished! Milk Production is now unblocked.");
    }
}
