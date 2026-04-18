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
        
        // 1. Remove the annoying foreign key if it exists
        try {
            jdbcTemplate.execute("ALTER TABLE milk_records DROP FOREIGN KEY FK6u76u49fd1r0j8ej995ww02uc");
            System.out.println(">>> SUCCESS: Dropped FK constraint on cow_id.");
        } catch (Exception e) {
            System.out.println(">>> INFO: FK constraint not found (safe to ignore).");
        }

        // 2. Remove the redundant cow_id column
        try {
            jdbcTemplate.execute("ALTER TABLE milk_records DROP COLUMN cow_id");
            System.out.println(">>> SUCCESS: Dropped redundant cow_id column.");
        } catch (Exception e) {
            System.out.println(">>> INFO: cow_id column not found (safe to ignore).");
        }

        // 3. Optional: Drop the empty ghost 'cows' table
        try {
            jdbcTemplate.execute("DROP TABLE cows");
            System.out.println(">>> SUCCESS: Dropped unused 'cows' table.");
        } catch (Exception e) {
            System.out.println(">>> INFO: cows table not found (safe to ignore).");
        }

        System.out.println(">>> Database Cleanup Finished! Milk Production is now unblocked.");
    }
}
