// OPT-IN PostgreSQL adapter for the attendance domain.
//
// This module is NOT used by the live app (which runs the in-browser mock on
// Vercel, or the JSON-file store in server/db.js). It's the "switch on later"
// half of the hybrid plan: a real SQL backend you can wire up when you host a
// Postgres database.
//
// To use it:
//   1. npm i pg            (in /server)
//   2. export DATABASE_URL=postgres://user:pass@host:5432/dbname
//   3. Apply sql/migrations/*.sql in order (see sql/README.md)
//   4. In server/index.js, swap the db.js calls for these query functions,
//      or set DB_DRIVER=sql and branch on it.
//
// It reuses the SAME pure status logic as the rest of the app
// (shared/attendance.js) so SQL results match the mock/JSON results exactly.

import { Pool } from "pg"; // requires `npm i pg`
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  dateKey, summarize, dayStatus, monthDates, leaveCovers, DEFAULT_WEEKEND_DAYS,
} from "../shared/attendance.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Most managed Postgres (Neon/Supabase/Render) require SSL.
  ssl: process.env.PGSSL === "disable" ? false : { rejectUnauthorized: false },
});

export const query = (text, params) => pool.query(text, params);

// Run every sql/migrations/*.sql file in order (idempotent).
export async function runMigrations() {
  const dir = path.join(__dirname, "..", "sql", "migrations");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    await query(fs.readFileSync(path.join(dir, f), "utf-8"));
  }
}

// ---- Settings --------------------------------------------------------------

export async function getSettings() {
  const s = (await query(`SELECT company_name, weekend_days FROM settings WHERE id = 1`)).rows[0]
    || { company_name: "Northwind", weekend_days: DEFAULT_WEEKEND_DAYS };
  const holidays = (await query(`SELECT holiday_date FROM holidays ORDER BY holiday_date`)).rows
    .map((r) => dateKey(new Date(r.holiday_date)));
  return { companyName: s.company_name, weekendDays: s.weekend_days, holidays };
}

export async function updateSettings({ companyName, weekendDays, holidays }) {
  if (companyName !== undefined || weekendDays !== undefined) {
    await query(
      `UPDATE settings SET
         company_name = COALESCE($1, company_name),
         weekend_days = COALESCE($2, weekend_days)
       WHERE id = 1`,
      [companyName ?? null, weekendDays ?? null]
    );
  }
  if (holidays !== undefined) {
    await query(`DELETE FROM holidays`);
    for (const d of holidays) await query(`INSERT INTO holidays (holiday_date) VALUES ($1)`, [d]);
  }
  return getSettings();
}

// ---- Employees -------------------------------------------------------------

const rowToEmployee = (r) => ({
  id: r.id, name: r.name, designation: r.designation, deptId: r.dept_id,
  managerId: r.manager_id, email: r.email,
  joinDate: dateKey(new Date(r.join_date)), status: r.status,
  avatar: r.avatar, avatarUrl: r.avatar_url, role: r.role,
  targetHours: Number(r.target_hours),
  halfDayCutoff: r.half_day_cutoff ? String(r.half_day_cutoff).slice(0, 5) : null,
  passwordHash: r.password_hash,
});

// Active employees only (deleted_at IS NULL).
export async function getEmployees() {
  return (await query(`SELECT * FROM employees WHERE deleted_at IS NULL ORDER BY id`)).rows.map(rowToEmployee);
}
// Any employee by id (incl. soft-deleted) — used for monthly history of formers.
export async function getEmployee(id) {
  const r = (await query(`SELECT * FROM employees WHERE id = $1`, [id])).rows[0];
  return r ? rowToEmployee(r) : null;
}
// Login lookup — active accounts only (deleted users can't sign in).
export async function getEmployeeByEmail(email) {
  const r = (await query(`SELECT * FROM employees WHERE LOWER(email) = LOWER($1) AND deleted_at IS NULL`, [email])).rows[0];
  return r ? rowToEmployee(r) : null;
}

export async function createEmployee(e) {
  const r = (await query(
    `INSERT INTO employees (name, designation, dept_id, email, role, target_hours, half_day_cutoff, avatar, password_hash)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [e.name, e.designation || "Employee", e.deptId, e.email, e.role || "employee",
     e.targetHours ?? 8, e.halfDayCutoff ?? null, e.avatar, e.passwordHash]
  )).rows[0];
  return rowToEmployee(r);
}

// Soft-deleted ("Old") employees, newest first. addedAt = join date.
export async function getDeletedEmployees() {
  return (await query(`SELECT * FROM employees WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC`)).rows.map((r) => ({
    ...rowToEmployee(r),
    addedAt: dateKey(new Date(r.join_date)),
    deletedAt: r.deleted_at.toISOString(),
  }));
}

// Soft-delete: mark the employee removed but KEEP the row so attendance,
// daily_attendance and leaves stay linked for the lifecycle (join -> deleted).
export async function deleteEmployee(id) {
  const res = await query(`UPDATE employees SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL`, [id]);
  return res.rowCount ? { ok: true, id } : null;
}

export async function updateEmployee(id, patch) {
  const cols = {
    name: "name", designation: "designation", deptId: "dept_id", email: "email",
    avatar: "avatar", avatarUrl: "avatar_url", targetHours: "target_hours",
    halfDayCutoff: "half_day_cutoff",
  };
  const sets = [], vals = [];
  for (const [k, col] of Object.entries(cols)) {
    if (patch[k] !== undefined) { vals.push(patch[k]); sets.push(`${col} = $${vals.length}`); }
  }
  if (!sets.length) return getEmployee(id);
  vals.push(id);
  const r = (await query(`UPDATE employees SET ${sets.join(", ")} WHERE id = $${vals.length} RETURNING *`, vals)).rows[0];
  return rowToEmployee(r);
}

// ---- Attendance punches ----------------------------------------------------

export async function getSessions(employeeId, date) {
  const rows = (await query(
    `SELECT clock_in, clock_out FROM attendance_sessions
     WHERE employee_id = $1 AND work_date = $2 ORDER BY clock_in`,
    [employeeId, date]
  )).rows;
  return rows.map((r) => ({ in: r.clock_in.toISOString(), out: r.clock_out ? r.clock_out.toISOString() : null }));
}

export async function clockIn(employeeId) {
  const date = dateKey();
  const open = (await query(
    `SELECT 1 FROM attendance_sessions WHERE employee_id = $1 AND work_date = $2 AND clock_out IS NULL`,
    [employeeId, date]
  )).rowCount;
  if (open) throw Object.assign(new Error("You are already clocked in"), { status: 409 });
  await query(
    `INSERT INTO attendance_sessions (employee_id, work_date, clock_in) VALUES ($1, $2, now())`,
    [employeeId, date]
  );
}

export async function clockOut(employeeId) {
  const date = dateKey();
  const res = await query(
    `UPDATE attendance_sessions SET clock_out = now()
     WHERE id = (SELECT id FROM attendance_sessions
                 WHERE employee_id = $1 AND work_date = $2 AND clock_out IS NULL
                 ORDER BY clock_in DESC LIMIT 1)`,
    [employeeId, date]
  );
  if (!res.rowCount) throw Object.assign(new Error("You are not clocked in"), { status: 409 });
}

// ---- Leaves ----------------------------------------------------------------

const rowToLeave = (r) => ({
  id: r.id, employeeId: r.employee_id, type: r.type,
  from: dateKey(new Date(r.from_date)), to: dateKey(new Date(r.to_date)),
  days: r.days, status: r.status, reason: r.reason,
});
export async function getLeaves(employeeId /* optional */) {
  const sql = employeeId
    ? [`SELECT * FROM leaves WHERE employee_id = $1 ORDER BY id`, [employeeId]]
    : [`SELECT * FROM leaves ORDER BY id`, []];
  return (await query(...sql)).rows.map(rowToLeave);
}

// ---- Automated daily status (Rule 1 + Rule 2) ------------------------------
// Compute and persist the status for one employee on one day. Run this from a
// nightly cron for every employee to satisfy "calculated automatically at the
// end of each day" — or call it on demand.
export async function summarizeAndStoreDaily(employeeId, date = dateKey()) {
  const emp = await getEmployee(employeeId);
  if (!emp) return null;
  const sessions = await getSessions(employeeId, date);
  const settings = await getSettings();
  const leaves = await getLeaves(employeeId);
  const onLeave = leaveCovers(leaves, employeeId, date);
  const status = dayStatus({
    date, sessions, halfDayCutoff: emp.halfDayCutoff, onLeave,
    weekendDays: settings.weekendDays, holidays: settings.holidays,
  });
  const s = summarize(sessions, emp.targetHours);
  await query(
    `INSERT INTO daily_attendance (employee_id, work_date, status, first_in, last_out, worked_sec, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6, now())
     ON CONFLICT (employee_id, work_date)
     DO UPDATE SET status = EXCLUDED.status, first_in = EXCLUDED.first_in,
                   last_out = EXCLUDED.last_out, worked_sec = EXCLUDED.worked_sec, updated_at = now()`,
    [employeeId, date, status, s.firstIn, s.lastOut, s.workedSec]
  );
  return status;
}

// Recompute the whole month for every employee and refresh monthly_summary.
export async function recomputeMonth(year, month) {
  const employees = await getEmployees();
  const settings = await getSettings();
  for (const emp of employees) {
    const totals = { present: 0, halfDay: 0, absent: 0, leave: 0, weekend: 0, holiday: 0, workingDays: 0 };
    for (const date of monthDates(year, month - 1)) {
      const status = await summarizeAndStoreDaily(emp.id, date);
      if (status === "Present") totals.present++;
      else if (status === "Half Day") totals.halfDay++;
      else if (status === "Absent") totals.absent++;
      else if (status === "Leave") totals.leave++;
      else if (status === "Weekend") totals.weekend++;
      else if (status === "Holiday") totals.holiday++;
      if (!["Weekend", "Holiday", "Upcoming"].includes(status)) totals.workingDays++;
    }
    await query(
      `INSERT INTO monthly_summary (employee_id, year, month, present, half_day, absent, leave, weekend, holiday, working_days)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (employee_id, year, month) DO UPDATE SET
         present=EXCLUDED.present, half_day=EXCLUDED.half_day, absent=EXCLUDED.absent,
         leave=EXCLUDED.leave, weekend=EXCLUDED.weekend, holiday=EXCLUDED.holiday,
         working_days=EXCLUDED.working_days`,
      [emp.id, year, month, totals.present, totals.halfDay, totals.absent,
       totals.leave, totals.weekend, totals.holiday, totals.workingDays]
    );
  }
}
