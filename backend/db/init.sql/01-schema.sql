-- ============================================================
-- ACADEMY MANAGEMENT SYSTEM - DATABASE SCHEMA
-- Idempotent: safe to run on every server start without data loss.
-- Uses IF NOT EXISTS guards on every statement.
-- ============================================================

-- ============================================================
-- ENUM TYPES
-- ============================================================
DO $$ BEGIN CREATE TYPE user_role AS ENUM ('admin', 'student', 'teacher'); EXCEPTION WHEN duplicate_object THEN null; END; $$;
DO $$ BEGIN CREATE TYPE user_status AS ENUM ('active', 'inactive'); EXCEPTION WHEN duplicate_object THEN null; END; $$;
DO $$ BEGIN CREATE TYPE gender_type AS ENUM ('M', 'F'); EXCEPTION WHEN duplicate_object THEN null; END; $$;
DO $$ BEGIN CREATE TYPE dominant_hand AS ENUM ('right', 'left', 'both'); EXCEPTION WHEN duplicate_object THEN null; END; $$;
DO $$ BEGIN CREATE TYPE modality_type AS ENUM ('in_person', 'virtual', 'residential'); EXCEPTION WHEN duplicate_object THEN null; END; $$;
DO $$ BEGIN CREATE TYPE day_of_week AS ENUM ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'); EXCEPTION WHEN duplicate_object THEN null; END; $$;
DO $$ BEGIN CREATE TYPE study_plan_type AS ENUM ('weekly', 'monthly', 'quarterly'); EXCEPTION WHEN duplicate_object THEN null; END; $$;
DO $$ BEGIN CREATE TYPE payment_mode_type AS ENUM ('prepaid', 'postpaid'); EXCEPTION WHEN duplicate_object THEN null; END; $$;
DO $$ BEGIN CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'pending'); EXCEPTION WHEN duplicate_object THEN null; END; $$;
DO $$ BEGIN CREATE TYPE invoice_status AS ENUM ('pending', 'paid', 'cancelled', 'overdue'); EXCEPTION WHEN duplicate_object THEN null; END; $$;

-- ============================================================
-- USERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  role user_role NOT NULL DEFAULT 'student',
  status user_status NOT NULL DEFAULT 'active',
  phone VARCHAR(20),

  department VARCHAR(50),
  municipality VARCHAR(50),

  dpi VARCHAR(20) UNIQUE,
  gender gender_type,
  dominant_hand dominant_hand,
  birthday DATE,

  guardian_name VARCHAR(100),
  guardian_phone VARCHAR(20),
  guardian_email VARCHAR(255),
  guardian_relationship VARCHAR(50),

  must_change_password BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- ============================================================
-- ACADEMY SETTINGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS academy_settings (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  subdomain VARCHAR(100) UNIQUE NOT NULL,

  primary_color VARCHAR(7) DEFAULT '#3B82F6',
  secondary_color VARCHAR(7) DEFAULT '#10B981',
  logo_url TEXT,

  bank_account_info TEXT,

  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_academy_settings_subdomain ON academy_settings(subdomain);
CREATE INDEX IF NOT EXISTS idx_academy_settings_is_active ON academy_settings(is_active);

-- Link each academy to its owning admin (idempotent)
ALTER TABLE academy_settings ADD COLUMN IF NOT EXISTS admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_academy_settings_admin_id ON academy_settings(admin_id);

-- Backfill for single-admin deployments where the association was never stored
UPDATE academy_settings
SET admin_id = (SELECT id FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1)
WHERE admin_id IS NULL
  AND (SELECT COUNT(*) FROM users WHERE role = 'admin') = 1;

-- ============================================================
-- PAYMENT METHODS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_methods (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  method_name VARCHAR(100) NOT NULL,
  account_number VARCHAR(100),
  account_holder VARCHAR(255),
  bank_name VARCHAR(100),
  additional_info TEXT,
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_admin_id ON payment_methods(admin_id);

-- ============================================================
-- STUDENT CONFIG TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS student_config (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

  payment_mode payment_mode_type NOT NULL DEFAULT 'postpaid',
  price_per_class DECIMAL(10, 2) DEFAULT 0,
  monthly_fixed_amount DECIMAL(10, 2),

  credit_balance DECIMAL(10, 2) DEFAULT 0.00,

  study_plan study_plan_type,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_student_config_student_id ON student_config(student_id);

-- ============================================================
-- CLASSES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS classes (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  title VARCHAR(255) NOT NULL,
  description TEXT,
  instructor VARCHAR(100),

  class_date DATE,
  class_time TIME,
  start_time TIME,
  end_time TIME,
  duration_minutes INTEGER DEFAULT 60,

  days_of_week day_of_week[] DEFAULT '{}',
  modality modality_type,

  max_students INTEGER DEFAULT 30,

  student_ids TEXT DEFAULT '[]',

  is_completed BOOLEAN DEFAULT false,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_classes_admin_id ON classes(admin_id);
CREATE INDEX IF NOT EXISTS idx_classes_class_date ON classes(class_date);
CREATE INDEX IF NOT EXISTS idx_classes_is_completed ON classes(is_completed);

-- Idempotent: add is_active if missing (existing rows get true by default)
ALTER TABLE classes ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
CREATE INDEX IF NOT EXISTS idx_classes_is_active ON classes(is_active);

-- ============================================================
-- CLASS INSCRIPTIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS class_inscriptions (
  id SERIAL PRIMARY KEY,
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  admin_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  enrollment_status VARCHAR(50) DEFAULT 'active',

  study_plan study_plan_type,
  payment_mode payment_mode_type,

  price_per_class DECIMAL(10, 2),
  monthly_amount DECIMAL(10, 2),

  enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(class_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_class_inscriptions_class_id ON class_inscriptions(class_id);
CREATE INDEX IF NOT EXISTS idx_class_inscriptions_student_id ON class_inscriptions(student_id);
CREATE INDEX IF NOT EXISTS idx_class_inscriptions_admin_id ON class_inscriptions(admin_id);

-- Per-student schedule within a class (idempotent)
ALTER TABLE class_inscriptions ADD COLUMN IF NOT EXISTS days_of_week day_of_week[] DEFAULT '{}';

-- ============================================================
-- STUDENT-ADMIN ASSOCIATION TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS student_admin_association (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(admin_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_student_admin_assoc_admin_id ON student_admin_association(admin_id);
CREATE INDEX IF NOT EXISTS idx_student_admin_assoc_student_id ON student_admin_association(student_id);

-- ============================================================
-- ATTENDANCE TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS attendance (
  id SERIAL PRIMARY KEY,
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  status attendance_status DEFAULT 'pending',
  marked_at TIMESTAMP WITH TIME ZONE,

  class_date DATE NOT NULL DEFAULT CURRENT_DATE,

  daily_cost DECIMAL(10, 2) DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(class_id, student_id, class_date)
);

-- ============================================================
-- ATTENDANCE EVOLUTION: Idempotent migration for existing DBs.
-- MUST run BEFORE the class_date index below so the column
-- exists on old databases before we try to index it.
-- ============================================================
DO $$
BEGIN
  -- 1. Add class_date if missing (existing rows get today as default)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendance' AND column_name = 'class_date'
  ) THEN
    ALTER TABLE attendance ADD COLUMN class_date DATE NOT NULL DEFAULT CURRENT_DATE;
  END IF;

  -- 2. Drop the old (class_id, student_id) unique constraint if it still exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'attendance_class_id_student_id_key'
      AND conrelid = 'attendance'::regclass
  ) THEN
    ALTER TABLE attendance DROP CONSTRAINT attendance_class_id_student_id_key;
  END IF;

  -- 3. Add the new per-day unique constraint if not yet present
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'attendance_class_id_student_id_date_key'
      AND conrelid = 'attendance'::regclass
  ) THEN
    ALTER TABLE attendance ADD CONSTRAINT attendance_class_id_student_id_date_key
      UNIQUE (class_id, student_id, class_date);
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Attendance migration warning: %', SQLERRM;
END; $$;

CREATE INDEX IF NOT EXISTS idx_attendance_class_id ON attendance(class_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance(status);
CREATE INDEX IF NOT EXISTS idx_attendance_class_date ON attendance(class_date);

-- ============================================================
-- INVOICES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  invoice_month VARCHAR(7) NOT NULL,
  status invoice_status DEFAULT 'pending',

  subtotal DECIMAL(10, 2) DEFAULT 0,
  credit_applied DECIMAL(10, 2) DEFAULT 0,
  total_amount DECIMAL(10, 2) DEFAULT 0,

  pdf_path TEXT,
  issued_at TIMESTAMP WITH TIME ZONE,
  due_date DATE,
  paid_at TIMESTAMP WITH TIME ZONE,

  notes TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(admin_id, student_id, invoice_month)
);

CREATE INDEX IF NOT EXISTS idx_invoices_admin_id ON invoices(admin_id);
CREATE INDEX IF NOT EXISTS idx_invoices_student_id ON invoices(student_id);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_month ON invoices(invoice_month);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

-- ============================================================
-- TRANSACTIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  admin_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  amount DECIMAL(10, 2) NOT NULL,
  transaction_type VARCHAR(50),
  payment_method VARCHAR(50),
  reference_number VARCHAR(255),

  status VARCHAR(50) DEFAULT 'completed',

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transactions_student_id ON transactions(student_id);
CREATE INDEX IF NOT EXISTS idx_transactions_admin_id ON transactions(admin_id);
CREATE INDEX IF NOT EXISTS idx_transactions_invoice_id ON transactions(invoice_id);

-- ============================================================
-- TRIGGER: Update updated_at timestamp
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_academy_settings_updated_at
  BEFORE UPDATE ON academy_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_student_config_updated_at
  BEFORE UPDATE ON student_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_classes_updated_at
  BEFORE UPDATE ON classes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_class_inscriptions_updated_at
  BEFORE UPDATE ON class_inscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_attendance_updated_at
  BEFORE UPDATE ON attendance FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_payment_methods_updated_at
  BEFORE UPDATE ON payment_methods FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
