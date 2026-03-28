-- ====================================================
-- MIGRATION: Add MANUAL_OPEN status to access_logs
-- ====================================================
-- Jalankan script ini di MySQL untuk update enum values
-- Hanya perlu dijalankan 1x SETELAH pull code update

ALTER TABLE access_logs MODIFY COLUMN status ENUM('VALID','INVALID','MANUAL_OPEN') DEFAULT 'INVALID';

-- Verify:
-- SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='access_logs' AND COLUMN_NAME='status';
-- Harus show: enum('VALID','INVALID','MANUAL_OPEN')
