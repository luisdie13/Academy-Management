-- ============================================================
-- MIGRATION 03 — Seed classes for Guatemala Excellence Academy
-- ============================================================
-- PROBLEM: Classes (Guitar, Piano) were created under admin_id 9
-- (Luis's Academy). Students who register with the GUATEMALA-EXCELLENCE
-- academy code are linked to admin_id 1 via student_admin_association.
-- getAvailableClasses JOINs on admin_id, so those students see zero classes.
--
-- SOLUTION: Insert sample classes owned by admin@academia.com (admin_id 1).
-- Luis's classes under admin_id 9 are left untouched.
--
-- IDEMPOTENT: Each row is only inserted when no class with the same
-- (admin_id, title) already exists, so re-running is safe.
-- ============================================================

INSERT INTO classes (admin_id, title, description, instructor, is_active)
SELECT
  (SELECT id FROM users WHERE email = 'admin@academia.com'),
  t.title,
  t.description,
  t.instructor,
  true
FROM (VALUES
  (
    'Guitar',
    'Classical and modern guitar fundamentals — from basic chords to fingerpicking technique.',
    'Prof. García'
  ),
  (
    'Piano',
    'Piano for beginners and intermediate students — scales, sight-reading, and repertoire.',
    'Prof. López'
  ),
  (
    'Music Theory',
    'Harmony, rhythm, ear training and notation — the foundation for every instrument.',
    'Prof. García'
  )
) AS t(title, description, instructor)
WHERE NOT EXISTS (
  SELECT 1
  FROM   classes c
  WHERE  c.admin_id = (SELECT id FROM users WHERE email = 'admin@academia.com')
    AND  c.title    = t.title
);

-- Verification query — run after migration to confirm rows landed:
-- SELECT id, admin_id, title, is_active
-- FROM   classes
-- WHERE  admin_id = (SELECT id FROM users WHERE email = 'admin@academia.com')
-- ORDER  BY id;
