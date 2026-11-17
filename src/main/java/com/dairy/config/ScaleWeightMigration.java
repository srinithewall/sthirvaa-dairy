package com.dairy.config;

import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * A weight can now be entered straight from a scale, with no heart-girth reading. ddl-auto=update
 * never relaxes NOT NULL, so herd_weight_records.heart_girth_cm is opened up here. Older servers
 * sharing this database always send a girth, so they are unaffected. Checks first; safe on every start.
 */
@Component
public class ScaleWeightMigration implements CommandLineRunner {

    private final JdbcTemplate jdbcTemplate;

    public ScaleWeightMigration(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(String... args) {
        try {
            String nullable = jdbcTemplate.queryForObject(
                    "SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() "
                            + "AND TABLE_NAME = 'herd_weight_records' AND COLUMN_NAME = 'heart_girth_cm'", String.class);
            if ("NO".equalsIgnoreCase(nullable)) {
                jdbcTemplate.execute("ALTER TABLE herd_weight_records MODIFY heart_girth_cm DOUBLE NULL");
                System.out.println(">>> herd_weight_records.heart_girth_cm is now optional (scale weights)");
            }
        } catch (Exception e) {
            System.out.println(">>> INFO: heart_girth_cm migration skipped: " + e.getMessage());
        }
    }
}
