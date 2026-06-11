-- Migration 0002 — seed reference data + a demo account.
-- The password hash below is bcrypt("password123"). Re-runnable (ON CONFLICT).

INSERT INTO departments (id, name) VALUES
  (1, 'Engineering'),
  (2, 'Product'),
  (3, 'People & HR'),
  (4, 'Sales'),
  (5, 'Finance')
ON CONFLICT (id) DO NOTHING;

-- Keep the SERIAL sequence ahead of the explicit ids above.
SELECT setval(pg_get_serial_sequence('departments','id'), (SELECT MAX(id) FROM departments));

INSERT INTO settings (id, company_name, weekend_days)
VALUES (1, 'Northwind', '{0,6}')
ON CONFLICT (id) DO NOTHING;

-- Demo employee — email aryanjaiswal@demo.do / password "password123".
INSERT INTO employees (id, name, designation, dept_id, email, join_date, role, target_hours, half_day_cutoff, avatar, password_hash)
VALUES (
  1, 'Aryan Jaiswal', 'Developer', 1, 'aryanjaiswal@demo.do', '2024-01-15',
  'employee', 8, '13:00', 'AJ',
  '$2a$10$O2rJqCDJIxlG7VqE0pz2euQHM8AP6.DeCbVLFA0qMM9M7FHq2AUXm'
)
ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('employees','id'), (SELECT MAX(id) FROM employees));
