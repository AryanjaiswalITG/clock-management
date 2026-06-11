-- Clock Management HRMS — PostgreSQL schema
-- Full attendance domain: profiles, punches, computed daily status, leaves,
-- weekend/holiday policy, and monthly rollups.
--
-- Apply with:  psql "$DATABASE_URL" -f sql/schema.sql
-- (or run the numbered files in sql/migrations/ in order).

-- ---- Reference data --------------------------------------------------------

CREATE TABLE IF NOT EXISTS departments (
  id   SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

-- ---- Employee profiles -----------------------------------------------------

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
  -- Half-Day Cutoff Time (local). If set and the first check-in is after it,
  -- the day is auto-marked 'Half Day'. NULL disables the rule.
  half_day_cutoff TIME,
  password_hash   TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_employees_dept ON employees(dept_id);

-- ---- Org settings (singleton row id=1) -------------------------------------

CREATE TABLE IF NOT EXISTS settings (
  id           INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  company_name TEXT NOT NULL DEFAULT 'Northwind',
  -- Weekend days as ISO dow ints: 0=Sun … 6=Sat. Default Sat+Sun.
  weekend_days INTEGER[] NOT NULL DEFAULT '{0,6}'
);

-- ---- Holidays --------------------------------------------------------------

CREATE TABLE IF NOT EXISTS holidays (
  holiday_date DATE PRIMARY KEY,
  label        TEXT
);

-- ---- Attendance punches (sessions) -----------------------------------------
-- One row per clock-in/out pair. clock_out NULL = currently clocked in.

CREATE TABLE IF NOT EXISTS attendance_sessions (
  id          BIGSERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  work_date   DATE NOT NULL,
  clock_in    TIMESTAMPTZ NOT NULL,
  clock_out   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_sessions_emp_date ON attendance_sessions(employee_id, work_date);

-- ---- Computed daily status (one row per employee per day) ------------------
-- Written by the end-of-day job (see server/sqlDb.js summarizeAndStoreDaily).

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

-- ---- Leaves ----------------------------------------------------------------

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

-- ---- Monthly summary rollup (per employee per month) -----------------------
-- Optional cache for fast reports; rebuilt from daily_attendance.

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

-- ---- Archive of admin-removed employees ("Old Employees") ------------------

CREATE TABLE IF NOT EXISTS deleted_employees (
  archive_id  BIGSERIAL PRIMARY KEY,
  employee_id INTEGER,
  name        TEXT NOT NULL,
  designation TEXT,
  dept_id     INTEGER,
  email       TEXT,
  avatar      TEXT,
  role        TEXT,
  added_at    DATE,
  deleted_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
