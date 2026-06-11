-- Migration 0003 — archive of admin-removed employees ("Old Employees").
-- A snapshot is written here on delete; the live row is then removed from
-- employees (its sessions/daily/leaves cascade away via their FKs).

CREATE TABLE IF NOT EXISTS deleted_employees (
  archive_id  BIGSERIAL PRIMARY KEY,
  employee_id INTEGER,
  name        TEXT NOT NULL,
  designation TEXT,
  dept_id     INTEGER,
  email       TEXT,
  avatar      TEXT,
  role        TEXT,
  added_at    DATE,             -- the employee's original join date
  deleted_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_deleted_employees_when ON deleted_employees(deleted_at DESC);
