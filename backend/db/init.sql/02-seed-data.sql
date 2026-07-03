-- ============================================================
-- SEED DATA  ·  Academy Management System
-- ============================================================
-- PURPOSE: Minimum data to boot a functional dev environment.
--   · Admin account     → enables login
--   · Academy settings  → enables /api/academies/validate
--   · Sample students   → enables testing student & billing flows
--
-- NOT INCLUDED: classes, inscriptions, attendance.
-- Create those through the UI after logging in as admin.
--
-- All IDs resolved via subquery — no hardcoded integers — so this
-- file stays correct and idempotent regardless of DB state.
-- ============================================================

-- ============================================================
-- ADMIN USER
-- ============================================================
INSERT INTO users (
  email, password_hash, first_name, last_name, role, status, phone,
  department, municipality, gender, birthday, must_change_password, is_active
) VALUES (
  'admin@academia.com',
  '$2a$12$4r.gSC20BU4FYZQ02YfbD.DXQRfyF41Qi0Sj0i4lAAE3vSgT2ggkG',
  'Admin',
  'Principal',
  'admin',
  'active',
  '+502-7123-4567',
  'Guatemala',
  'Guatemala',
  'M',
  '1985-05-15',
  false,
  true
) ON CONFLICT (email) DO NOTHING;

-- ============================================================
-- ACADEMY SETTINGS
-- Unique constraint: subdomain
-- admin_id resolved via subquery to avoid hardcoded IDs.
-- DO UPDATE patches existing rows that were inserted without admin_id.
-- ============================================================
INSERT INTO academy_settings (
  name, subdomain, primary_color, secondary_color,
  logo_url, bank_account_info, is_active, admin_id
) VALUES (
  'Guatemala Excellence Academy',
  'guatemala-excellence',
  '#3B82F6',
  '#10B981',
  NULL,
  'Banco Industrial – Account 123-456789-0 | Beneficiary: Guatemala Excellence Academy',
  true,
  (SELECT id FROM users WHERE email = 'admin@academia.com')
) ON CONFLICT (subdomain) DO UPDATE
  SET admin_id = EXCLUDED.admin_id
  WHERE academy_settings.admin_id IS NULL;

-- ============================================================
-- STUDENT USERS  (demo accounts)
-- Unique constraint: email
-- ============================================================
INSERT INTO users (
  email, password_hash, first_name, last_name, role, status, phone,
  department, municipality, dpi, gender, dominant_hand, birthday,
  guardian_name, guardian_phone, guardian_email, guardian_relationship,
  must_change_password, is_active
) VALUES
(
  'juan.perez@email.com',
  '$2a$12$93fZhnt8E2fDpWXUCNGoEeJ9/JGRTnHX6eu5l9PruodDoQVzt.kty',
  'Juan', 'Perez', 'student', 'active', '+502-7234-5678',
  'Guatemala', 'Guatemala', '1234567890123', 'M', 'right', '2005-03-20',
  'Maria Perez', '+502-7234-5679', 'maria.perez@email.com', 'Mother',
  true, true
),
(
  'ana.garcia@email.com',
  '$2a$12$93fZhnt8E2fDpWXUCNGoEeJ9/JGRTnHX6eu5l9PruodDoQVzt.kty',
  'Ana', 'Garcia', 'student', 'active', '+502-7345-6789',
  'Sacatepequez', 'Antigua Guatemala', '9876543210987', 'F', 'left', '2004-07-15',
  'Carlos Garcia', '+502-7345-6790', 'carlos.garcia@email.com', 'Father',
  true, true
),
(
  'luis.lopez@email.com',
  '$2a$12$93fZhnt8E2fDpWXUCNGoEeJ9/JGRTnHX6eu5l9PruodDoQVzt.kty',
  'Luis', 'Lopez', 'student', 'active', '+502-7456-7890',
  'Escuintla', 'Escuintla', '5555555555555', 'M', 'both', '2006-11-08',
  'Rosa Lopez', '+502-7456-7891', 'rosa.lopez@email.com', 'Mother',
  true, true
) ON CONFLICT (email) DO NOTHING;

-- ============================================================
-- STUDENT CONFIG  (one per student — subquery resolves IDs)
-- Unique constraint: student_id
-- ============================================================
INSERT INTO student_config (student_id, payment_mode, price_per_class, monthly_fixed_amount, study_plan, credit_balance)
VALUES ((SELECT id FROM users WHERE email = 'juan.perez@email.com'), 'postpaid', 150.00, NULL, 'weekly', 0.00)
ON CONFLICT (student_id) DO NOTHING;

INSERT INTO student_config (student_id, payment_mode, price_per_class, monthly_fixed_amount, study_plan, credit_balance)
VALUES ((SELECT id FROM users WHERE email = 'ana.garcia@email.com'), 'prepaid', 1500.00, 1500.00, 'monthly', 0.00)
ON CONFLICT (student_id) DO NOTHING;

INSERT INTO student_config (student_id, payment_mode, price_per_class, monthly_fixed_amount, study_plan, credit_balance)
VALUES ((SELECT id FROM users WHERE email = 'luis.lopez@email.com'), 'prepaid', 4500.00, 4500.00, 'quarterly', 0.00)
ON CONFLICT (student_id) DO NOTHING;

-- ============================================================
-- STUDENT-ADMIN ASSOCIATION  (subquery resolves IDs)
-- Unique constraint: (admin_id, student_id)
-- ============================================================
INSERT INTO student_admin_association (admin_id, student_id)
SELECT
  (SELECT id FROM users WHERE email = 'admin@academia.com'),
  id
FROM users
WHERE email IN ('juan.perez@email.com', 'ana.garcia@email.com', 'luis.lopez@email.com')
ON CONFLICT (admin_id, student_id) DO NOTHING;

-- ============================================================
-- INVOICES  (demo billing data — no class dependency)
-- Unique constraint: (admin_id, student_id, invoice_month)
-- ============================================================
INSERT INTO invoices (admin_id, student_id, invoice_month, status, subtotal, credit_applied, total_amount, issued_at, due_date, notes)
VALUES (
  (SELECT id FROM users WHERE email = 'admin@academia.com'),
  (SELECT id FROM users WHERE email = 'juan.perez@email.com'),
  '2026-06', 'pending', 300.00, 0.00, 300.00, '2026-06-25', '2026-07-10',
  'June attendance – weekly postpaid plan'
) ON CONFLICT (admin_id, student_id, invoice_month) DO NOTHING;

INSERT INTO invoices (admin_id, student_id, invoice_month, status, subtotal, credit_applied, total_amount, issued_at, due_date, notes)
VALUES (
  (SELECT id FROM users WHERE email = 'admin@academia.com'),
  (SELECT id FROM users WHERE email = 'ana.garcia@email.com'),
  '2026-06', 'pending', 1500.00, 0.00, 1500.00, '2026-06-25', '2026-07-10',
  'Monthly prepaid plan'
) ON CONFLICT (admin_id, student_id, invoice_month) DO NOTHING;

INSERT INTO invoices (admin_id, student_id, invoice_month, status, subtotal, credit_applied, total_amount, issued_at, due_date, notes)
VALUES (
  (SELECT id FROM users WHERE email = 'admin@academia.com'),
  (SELECT id FROM users WHERE email = 'luis.lopez@email.com'),
  '2026-06', 'pending', 1500.00, 0.00, 1500.00, '2026-06-25', '2026-07-10',
  'Quarterly prepaid plan – prorated for June'
) ON CONFLICT (admin_id, student_id, invoice_month) DO NOTHING;

-- ============================================================
-- TRANSACTIONS  (demo payment records)
-- No UNIQUE constraint — dedup guard via WHERE NOT EXISTS on reference_number.
-- ============================================================
INSERT INTO transactions (invoice_id, student_id, admin_id, amount, transaction_type, payment_method, reference_number, status)
SELECT
  (SELECT id FROM invoices WHERE student_id = (SELECT id FROM users WHERE email = 'ana.garcia@email.com')  AND invoice_month = '2026-06'),
  (SELECT id FROM users WHERE email = 'ana.garcia@email.com'),
  (SELECT id FROM users WHERE email = 'admin@academia.com'),
  1500.00, 'payment', 'transfer', 'TXN-2026-06-001', 'completed'
WHERE NOT EXISTS (SELECT 1 FROM transactions WHERE reference_number = 'TXN-2026-06-001');

INSERT INTO transactions (invoice_id, student_id, admin_id, amount, transaction_type, payment_method, reference_number, status)
SELECT
  (SELECT id FROM invoices WHERE student_id = (SELECT id FROM users WHERE email = 'luis.lopez@email.com') AND invoice_month = '2026-06'),
  (SELECT id FROM users WHERE email = 'luis.lopez@email.com'),
  (SELECT id FROM users WHERE email = 'admin@academia.com'),
  4500.00, 'payment', 'cash', 'TXN-2026-06-002', 'completed'
WHERE NOT EXISTS (SELECT 1 FROM transactions WHERE reference_number = 'TXN-2026-06-002');

-- ============================================================
-- REPAIR: student_admin_association
-- Retroactively create missing associations for any student who
-- has class_inscriptions (enrolled during registration) but lost
-- their student_admin_association row.
-- Idempotent: ON CONFLICT DO NOTHING is safe on repeated runs.
-- ============================================================
INSERT INTO student_admin_association (admin_id, student_id)
SELECT DISTINCT ci.admin_id, ci.student_id
FROM class_inscriptions ci
WHERE NOT EXISTS (
  SELECT 1
  FROM student_admin_association saa
  WHERE saa.student_id = ci.student_id
    AND saa.admin_id   = ci.admin_id
)
ON CONFLICT (admin_id, student_id) DO NOTHING;
