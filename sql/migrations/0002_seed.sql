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

-- Demo accounts — all use password "password123" (same bcrypt hash below).
-- admin@demo.do is an HR admin; the rest are employees.
INSERT INTO employees (id, name, designation, dept_id, manager_id, email, join_date, role, target_hours, half_day_cutoff, avatar, password_hash)
VALUES
  (1, 'Aryan Jaiswal', 'Developer',         1, 2,    'aryanjaiswal@demo.do', '2024-01-15', 'employee', 8, '13:00', 'AJ', '$2a$10$O2rJqCDJIxlG7VqE0pz2euQHM8AP6.DeCbVLFA0qMM9M7FHq2AUXm'),
  (2, 'Meera Nair',    'HR Manager',        3, NULL, 'admin@demo.do',        '2022-03-01', 'admin',    8, NULL,    'MN', '$2a$10$O2rJqCDJIxlG7VqE0pz2euQHM8AP6.DeCbVLFA0qMM9M7FHq2AUXm'),
  (3, 'Kabir Singh',   'Product Designer',  2, 2,    'kabir@demo.do',        '2023-06-10', 'employee', 8, '13:00', 'KS', '$2a$10$O2rJqCDJIxlG7VqE0pz2euQHM8AP6.DeCbVLFA0qMM9M7FHq2AUXm'),
  (4, 'Diya Sharma',   'Sales Executive',   4, 2,    'diya@demo.do',         '2023-09-05', 'employee', 8, NULL,    'DS', '$2a$10$O2rJqCDJIxlG7VqE0pz2euQHM8AP6.DeCbVLFA0qMM9M7FHq2AUXm'),
  (5, 'Rohan Mehta',   'Accountant',        5, 2,    'rohan@demo.do',        '2024-02-20', 'employee', 8, NULL,    'RM', '$2a$10$O2rJqCDJIxlG7VqE0pz2euQHM8AP6.DeCbVLFA0qMM9M7FHq2AUXm'),
  (6, 'Ananya Rao',    'Software Engineer', 1, 1,    'ananya@demo.do',       '2024-04-01', 'employee', 8, '13:30', 'AR', '$2a$10$O2rJqCDJIxlG7VqE0pz2euQHM8AP6.DeCbVLFA0qMM9M7FHq2AUXm')
ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('employees','id'), (SELECT MAX(id) FROM employees));
