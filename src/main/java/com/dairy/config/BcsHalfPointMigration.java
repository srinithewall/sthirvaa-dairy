package com.dairy.config;

import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * BCS went from whole points to half points (2.5, 3.5). ddl-auto=update adds herd_events.score but
 * never widens herds.bcs from INT, and the old readings sit in herd_events.quantity. The readings are
 * copied, not moved: the server shares this database and reads quantity until it is redeployed.
 * Each step checks first, so it is safe on every start.
 */
@Component
public class BcsHalfPointMigration implements CommandLineRunner {

    private final JdbcTemplate jdbcTemplate;

    public BcsHalfPointMigration(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(String... args) {
        try {
            String type = jdbcTemplate.queryForObject(
                    "SELECT DATA_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() "
                            + "AND TABLE_NAME = 'herds' AND COLUMN_NAME = 'bcs'", String.class);
            if (!"decimal".equalsIgnoreCase(type)) {
                jdbcTemplate.execute("ALTER TABLE herds MODIFY bcs DECIMAL(2,1) NULL");
                System.out.println(">>> herds.bcs now holds half points");
            }
        } catch (Exception e) {
            System.out.println(">>> INFO: herds.bcs migration skipped: " + e.getMessage());
        }
        try {
            int moved = jdbcTemplate.update(
                    "UPDATE herd_events SET score = quantity "
                            + "WHERE event_type = 'BCS_SCORED' AND score IS NULL AND quantity IS NOT NULL");
            if (moved > 0) System.out.println(">>> copied " + moved + " BCS readings to herd_events.score");
        } catch (Exception e) {
            System.out.println(">>> INFO: BCS readings migration skipped: " + e.getMessage());
        }
    }
}
