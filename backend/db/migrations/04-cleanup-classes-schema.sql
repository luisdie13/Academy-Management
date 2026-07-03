-- ============================================================
-- MIGRATION 04 — Schema cleanup: classes table
-- ============================================================
-- AUDIT RESULT (2026-07-02):
--   Only `max_students` has zero references across all controllers,
--   models, and services. Every other column is actively used:
--
--   modality       → ClassInscription.getByStudent (explicit SELECT)
--   class_date     → Class.getClassesByDateRange, Attendance.getByStudentAndDateRange
--   class_time     → Class.update (fieldMapping SET), Attendance.getByStudentAndDateRange
--   start_time     → Class.getClassesByStudent RETURNING, ClassInscription.getByStudent
--   end_time       → Class.getClassesByStudent RETURNING, ClassInscription.getByStudent
--   duration_mins  → Class.update (fieldMapping SET), Attendance.getByStudentAndDateRange
--   days_of_week   → ClassInscription.getByStudent (explicit SELECT)
--   student_ids    → userController.validateAndProcessClasses (SELECT + UPDATE)
--   is_completed   → Class.update (fieldMapping SET)
--
-- SAFE TO DROP: max_students only.
-- ============================================================

ALTER TABLE classes DROP COLUMN IF EXISTS max_students;

-- Verification query — run after migration to confirm column is gone:
-- SELECT column_name
-- FROM   information_schema.columns
-- WHERE  table_name = 'classes'
-- ORDER  BY ordinal_position;
