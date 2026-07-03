-- ============================================================
-- MIGRATION 05 — Full database reset
-- ============================================================
-- WARNING: This permanently deletes ALL data in every table
-- and resets all auto-increment sequences to 1.
--
-- Intended for development environment resets only.
-- Do NOT run this against a production database.
--
-- CASCADE handles FK dependencies automatically.
-- RESTART IDENTITY resets all SERIAL sequences.
-- ============================================================

TRUNCATE TABLE
  transactions,
  invoices,
  class_inscriptions,
  attendance,
  student_config,
  student_admin_association,
  classes,
  academy_settings,
  users
RESTART IDENTITY CASCADE;
