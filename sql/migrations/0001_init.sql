-- Migration 0001 — initial attendance schema.
-- Idempotent (IF NOT EXISTS) so it is safe to re-run.
-- Mirrors sql/schema.sql; run migrations in numeric order.

CREATE TABLE IF NOT EXISTS departments (
  id   SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS employees (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  designation     TEXT NOT NULL DEFAULT 'Employee',
  dept_id         INTEGER REFERENCES departments(id),
  manager_id      INTEGER REFERENCES employees(id),
  email           TEXT NOT NULL UNIQUE,
  join_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  status          TEXT NOT NULL DEFAULT 'Active',
  avatar          TEXT,
  avatar_url      TEXT,
  role            TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('employee','admin')),
  target_hours    NUMERIC(4,2) NOT NULL DEFAULT 8,
  half_day_cutoff TIME,
  password_hash   TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_employees_dept ON employees(dept_id);

CREATE TABLE IF NOT EXISTS settings (
  id           INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  company_name TEXT NOT NULL DEFAULT 'Northwind',
  weekend_days INTEGER[] NOT NULL DEFAULT '{0,6}'
);

CREATE TABLE IF NOT EXISTS holidays (
  holiday_date DATE PRIMARY KEY,
  label        TEXT
);

CREATE TABLE IF NOT EXISTS attendance_sessions (
  id          BIGSERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  work_date   DATE NOT NULL,
  clock_in    TIMESTAMPTZ NOT NULL,
  clock_out   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_sessions_emp_date ON attendance_sessions(employee_id, work_date);

CREATE TABLE IF NOT EXISTS daily_attendance (
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  work_date   DATE NOT NULL,
  status      TEXT NOT NULL CHECK (status IN
                ('Present','Half Day','Absent','Leave','Weekend','Holiday','Pending','Upcoming')),
  first_in    TIMESTAMPTZ,
  last_out    TIMESTAMPTZ,
  worked_sec  INTEGER NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (employee_id, work_date)
);

CREATE TABLE IF NOT EXISTS leaves (
  id          SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  from_date   DATE NOT NULL,
  to_date     DATE NOT NULL,
  days        INTEGER NOT NULL DEFAULT 1,
  status      TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Rejected')),
  reason      TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_leaves_emp ON leaves(employee_id);

CREATE TABLE IF NOT EXISTS monthly_summary (
  employee_id  INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  year         INTEGER NOT NULL,
  month        INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  present      INTEGER NOT NULL DEFAULT 0,
  half_day     INTEGER NOT NULL DEFAULT 0,
  absent       INTEGER NOT NULL DEFAULT 0,
  leave        INTEGER NOT NULL DEFAULT 0,
  weekend      INTEGER NOT NULL DEFAULT 0,
  holiday      INTEGER NOT NULL DEFAULT 0,
  working_days INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (employee_id, year, month)
);
