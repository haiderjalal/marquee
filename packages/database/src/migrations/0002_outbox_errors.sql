-- 0002_outbox_errors.sql
-- Records the last delivery error for an outbox message so operators can see why a
-- message is retrying or dead-lettered. Adds a column only; existing rows are unaffected.
-- Error text is stored without personal data: workers record the failure category.

ALTER TABLE outbox_message ADD COLUMN last_error text CHECK (last_error IS NULL OR length(last_error) <= 500);
