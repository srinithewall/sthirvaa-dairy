-- Herd "Advanced" fields: Pashu Aadhaar (Bharat Pashudhan ear tag) and insurance.
-- All columns are nullable, so existing rows and older backend builds are unaffected.
-- Hibernate (ddl-auto=update) adds these on startup; this file is for running by hand.

ALTER TABLE herds
    ADD COLUMN pashu_aadhaar       VARCHAR(12)  NULL,
    ADD COLUMN insurance_company   VARCHAR(255) NULL,
    ADD COLUMN insurance_policy_no VARCHAR(255) NULL,
    ADD COLUMN insured_value       DOUBLE       NULL,
    ADD COLUMN insurance_expiry    DATE         NULL;
