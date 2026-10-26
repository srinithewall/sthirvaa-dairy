package com.dairy.config;

import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Schema changes Hibernate's ddl-auto=update won't make on an existing table (it never relaxes a
 * NOT NULL). Each step checks first, so it is safe on every start.
 */
@Component
public class StoreSchemaMigration implements CommandLineRunner {

    private final JdbcTemplate jdbcTemplate;

    public StoreSchemaMigration(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(String... args) {
        // Contact phone became optional.
        try {
            String nullable = jdbcTemplate.queryForObject(
                    "SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() "
                            + "AND TABLE_NAME = 'store_farmers' AND COLUMN_NAME = 'phone'", String.class);
            if ("NO".equals(nullable)) {
                jdbcTemplate.execute("ALTER TABLE store_farmers MODIFY phone VARCHAR(15) NULL");
                System.out.println(">>> store_farmers.phone is now optional");
            }
        } catch (Exception e) {
            System.out.println(">>> INFO: store_farmers.phone migration skipped: " + e.getMessage());
        }
    }
}
