-- Migration 0003 — soft-delete for employees ("Old Employees" / audit).
-- Deleting a user must NOT remove their attendance history, so instead of
-- removing the row (which would cascade away sessions/daily/leaves), we mark
-- the employee with deleted_at. Active employees = deleted_at IS NULL.
-- Attendance stays linked for the user's lifecycle (join_date -> deleted_at).

ALTER TABLE employees ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(deleted_at);
