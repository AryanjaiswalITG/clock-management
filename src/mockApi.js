// In-browser backend for the GitHub Pages (server-less) deployment.
// Mirrors server/index.js, but persists to localStorage instead of data.json.
// NOTE: data lives in THIS browser only — it is not shared between visitors,
// and clearing site data resets it. Passwords are stored in plain text here
// because there is no server boundary; do not reuse a real password.

import {
  dateKey, summarize, monthlyForEmployee, monthlyForTeam, DEFAULT_WEEKEND_DAYS,
  applyRegularization,
} from "../shared/attendance.js";
import { validateLeaveRequest } from "../shared/leave.js";
import { buildDemoData, SEED_VERSION } from "../shared/demoSeed.js";

const DB_KEY = "nw_mock_db";
const TOKEN_KEY = "nw_token";
const DEFAULT_PASSWORD = "password123";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CUTOFF_RE = /^([01]\d|2[0-3]):[0-5]\d$/; // "HH:MM" 24h

// "Aryan Jaiswal" -> "AJ"
function initials(name) {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return String(name).trim().slice(0, 2).toUpperCase() || "?";
}

// ---- Seed (matches server/db.js) -------------------------------------------
// Demo profiles/attendance/leaves come from shared/demoSeed.js; the mock stores
// plaintext passwords (no server boundary). password = "password123" for all.
function seedDatabase() {
  const data = buildDemoData(new Date());
  return {
    departments: data.departments,
    employees: data.employees.map((e) => ({ ...e, password: DEFAULT_PASSWORD })),
    leaves: data.leaves,
    attendance: data.attendance,
    regularizations: data.regularizations,
    deletedEmployees: [], // archive of admin-removed employees
    settings: { companyName: "Northwind", weekendDays: DEFAULT_WEEKEND_DAYS, holidays: data.holidays },
    _nextLeaveId: data._nextLeaveId,
    _nextRegId: data._nextRegId,
    _seedVersion: SEED_VERSION,
  };
}

function loadDb() {
  let db;
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) db = JSON.parse(raw);
  } catch { /* fall through to seed */ }
  // Fresh browser OR an older demo seed -> (re)seed with the latest demo data.
  if (!db || (db._seedVersion || 0) < SEED_VERSION) {
    db = seedDatabase();
    saveDb(db);
    return db;
  }
  // Same version: just patch any missing fields defensively.
  let migrated = false;
  if (!db.settings) { db.settings = { companyName: "Northwind" }; migrated = true; }
  if (!Array.isArray(db.settings.weekendDays)) { db.settings.weekendDays = DEFAULT_WEEKEND_DAYS; migrated = true; }
  if (!Array.isArray(db.settings.holidays)) { db.settings.holidays = []; migrated = true; }
  if (!Array.isArray(db.deletedEmployees)) { db.deletedEmployees = []; migrated = true; }
  if (!Array.isArray(db.regularizations)) { db.regularizations = []; migrated = true; }
  if (typeof db._nextRegId !== "number") { db._nextRegId = 1; migrated = true; }
  for (const e of db.employees) {
    if (!("halfDayCutoff" in e)) { e.halfDayCutoff = null; migrated = true; }
  }
  if (migrated) saveDb(db);
  return db;
}
function saveDb(db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

// ---- Attendance helpers (db-aware; pure math comes from shared/) ------------
function todayRecord(db, employeeId, { create = false } = {}) {
  const today = dateKey();
  let rec = db.attendance.find((a) => a.employeeId === employeeId && a.date === today);
  if (!rec && create) {
    rec = { employeeId, date: today, sessions: [] };
    db.attendance.push(rec);
  }
  return rec;
}
function isClockedIn(rec) {
  return !!rec && rec.sessions.some((s) => s.out === null);
}

const publicEmployee = ({ password, ...rest }) => rest;

// Build the api object. ApiError is injected to avoid a circular import.
export function createMockApi(ApiError) {
  // Simulate a tiny network delay so loading states still render.
  const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms));

  // Current user from the stored token ("mock:<id>").
  function currentUser(db) {
    const token = localStorage.getItem(TOKEN_KEY) || "";
    const id = token.startsWith("mock:") ? Number(token.slice(5)) : NaN;
    return db.employees.find((e) => e.id === id) || null;
  }
  function requireUser(db) {
    const u = currentUser(db);
    if (!u) throw new ApiError("Not authenticated", 401);
    return u;
  }

  // ---- Role scoping ---------------------------------------------------------
  const reportsOf = (db, managerId) => db.employees.filter((e) => e.managerId === managerId);
  // The set of employee ids a user may see: admin → everyone; manager → self +
  // direct reports; employee → just themselves.
  function visibleIds(db, user) {
    if (user.role === "admin") return new Set(db.employees.map((e) => e.id));
    if (user.role === "manager") return new Set([user.id, ...reportsOf(db, user.id).map((e) => e.id)]);
    return new Set([user.id]);
  }
  // Managers + admins can approve requests; the rest cannot.
  const canApprove = (user) => user.role === "admin" || user.role === "manager";

  return {
    async login(email, password) {
      await delay();
      const db = loadDb();
      const emp = db.employees.find(
        (e) => e.email.toLowerCase() === String(email).toLowerCase()
      );
      if (!emp || emp.password !== password) {
        throw new ApiError("Invalid email or password", 401);
      }
      return { token: `mock:${emp.id}`, user: publicEmployee(emp) };
    },

    async register({ name, email, password } = {}) {
      await delay();
      const db = loadDb();
      const trimmedName = String(name || "").trim();
      const trimmedEmail = String(email || "").trim().toLowerCase();
      if (!trimmedName) throw new ApiError("Full name is required", 400);
      if (!EMAIL_RE.test(trimmedEmail)) throw new ApiError("Please enter a valid email address", 400);
      if (!password || String(password).length < 6) {
        throw new ApiError("Password must be at least 6 characters", 400);
      }
      if (db.employees.some((e) => e.email.toLowerCase() === trimmedEmail)) {
        throw new ApiError("An account with this email already exists", 409);
      }
      const id = db.employees.reduce((max, e) => Math.max(max, e.id), 0) + 1;
      const emp = {
        id, name: trimmedName, designation: "Employee",
        deptId: db.departments[0]?.id ?? 1, managerId: null, email: trimmedEmail,
        joinDate: dateKey(), status: "Active", avatar: initials(trimmedName),
        avatarUrl: null, role: "employee", targetHours: 8, halfDayCutoff: null,
        password: String(password),
      };
      db.employees.push(emp);
      saveDb(db);
      return { token: `mock:${emp.id}`, user: publicEmployee(emp) };
    },

    async logout() { await delay(40); return { ok: true }; },

    async demoAccount() {
      await delay(40);
      const db = loadDb();
      return { email: db.employees[0]?.email || "", password: DEFAULT_PASSWORD };
    },

    async settings() { await delay(40); return loadDb().settings; },

    async updateSettings(payload = {}) {
      await delay();
      const db = loadDb();
      const me = requireUser(db);
      // Org-wide settings (company name, weekend days, holidays) are shared by
      // everyone, so only admins may change them — a normal user's edit must
      // never leak into the admin's (or anyone else's) account.
      if (me.role !== "admin") throw new ApiError("Only admins can change company settings", 403);
      if (payload.companyName !== undefined) {
        const trimmed = String(payload.companyName).trim();
        if (!trimmed) throw new ApiError("Company name cannot be empty", 400);
        if (trimmed.length > 40) throw new ApiError("Company name is too long", 400);
        db.settings.companyName = trimmed;
      }
      if (payload.weekendDays !== undefined) {
        const wd = payload.weekendDays;
        if (!Array.isArray(wd) || wd.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
          throw new ApiError("weekendDays must be an array of 0–6 (Sun–Sat)", 400);
        }
        db.settings.weekendDays = [...new Set(wd)].sort((a, b) => a - b);
      }
      if (payload.holidays !== undefined) {
        const hs = payload.holidays;
        if (!Array.isArray(hs) || hs.some((h) => !/^\d{4}-\d{2}-\d{2}$/.test(h))) {
          throw new ApiError("holidays must be an array of YYYY-MM-DD dates", 400);
        }
        db.settings.holidays = [...new Set(hs)].sort();
      }
      saveDb(db);
      return db.settings;
    },

    async me() {
      await delay(40);
      const db = loadDb();
      return publicEmployee(requireUser(db));
    },

    // Self-service account deletion. Archives the user and preserves their
    // attendance/leaves (for admin history), then ends the session.
    async deleteMe() {
      await delay();
      const db = loadDb();
      const me = requireUser(db);
      db.deletedEmployees = db.deletedEmployees || [];
      db.deletedEmployees.unshift({
        ...publicEmployee(me),
        addedAt: me.joinDate,
        deletedAt: new Date().toISOString(),
      });
      db.employees = db.employees.filter((e) => e.id !== me.id);
      saveDb(db);
      localStorage.removeItem(TOKEN_KEY); // end the session
      return { ok: true };
    },

    async updateProfile(payload = {}) {
      await delay();
      const db = loadDb();
      const emp = requireUser(db);
      const { name, designation, email, deptId, targetHours, avatarUrl, halfDayCutoff } = payload;
      if (name !== undefined) {
        const t = String(name).trim();
        if (!t) throw new ApiError("Name cannot be empty", 400);
        emp.name = t; emp.avatar = initials(t);
      }
      if (designation !== undefined) {
        const t = String(designation).trim();
        if (!t) throw new ApiError("Designation cannot be empty", 400);
        emp.designation = t;
      }
      if (email !== undefined) {
        const t = String(email).trim().toLowerCase();
        if (!EMAIL_RE.test(t)) throw new ApiError("Please enter a valid email address", 400);
        if (db.employees.some((e) => e.id !== emp.id && e.email.toLowerCase() === t)) {
          throw new ApiError("That email is already in use", 409);
        }
        emp.email = t;
      }
      if (deptId !== undefined) {
        const id = Number(deptId);
        if (!db.departments.some((d) => d.id === id)) throw new ApiError("Unknown department", 400);
        emp.deptId = id;
      }
      if (targetHours !== undefined) {
        const n = Number(targetHours);
        if (!Number.isFinite(n) || n < 1 || n > 24) {
          throw new ApiError("Daily target must be between 1 and 24 hours", 400);
        }
        emp.targetHours = n;
      }
      if (halfDayCutoff !== undefined) {
        if (halfDayCutoff === null || halfDayCutoff === "") emp.halfDayCutoff = null;
        else if (CUTOFF_RE.test(String(halfDayCutoff))) emp.halfDayCutoff = String(halfDayCutoff);
        else throw new ApiError("Half-day cutoff must be a time like 13:00", 400);
      }
      if (avatarUrl !== undefined) {
        if (avatarUrl === null || avatarUrl === "") emp.avatarUrl = null;
        else {
          if (typeof avatarUrl !== "string" || !avatarUrl.startsWith("data:image/")) {
            throw new ApiError("Profile photo must be an image", 400);
          }
          emp.avatarUrl = avatarUrl;
        }
      }
      saveDb(db);
      return publicEmployee(emp);
    },

    async departments() { await delay(40); const db = loadDb(); requireUser(db); return db.departments; },

    // Directory scoped to the caller's role: admin → everyone; manager → self +
    // direct reports; employee → just themselves.
    async employees() {
      await delay();
      const db = loadDb();
      const me = requireUser(db);
      const ids = visibleIds(db, me);
      return db.employees.filter((e) => ids.has(e.id)).map(publicEmployee);
    },

    // Admin creates an employee (same fields as signup). Does NOT change the
    // admin's own session.
    async createEmployee(payload = {}) {
      await delay();
      const db = loadDb();
      const admin = requireUser(db);
      if (admin.role !== "admin") throw new ApiError("Admins only", 403);
      const name = String(payload.name || "").trim();
      const email = String(payload.email || "").trim().toLowerCase();
      const password = payload.password;
      if (!name) throw new ApiError("Full name is required", 400);
      if (!EMAIL_RE.test(email)) throw new ApiError("Please enter a valid email address", 400);
      if (!password || String(password).length < 6) throw new ApiError("Password must be at least 6 characters", 400);
      if (db.employees.some((e) => e.email.toLowerCase() === email)) {
        throw new ApiError("An account with this email already exists", 409);
      }
      const id = db.employees.reduce((m, e) => Math.max(m, e.id), 0) + 1;
      const emp = {
        id, name, designation: "Employee", deptId: db.departments[0]?.id ?? 1,
        managerId: null, email, joinDate: dateKey(), status: "Active",
        avatar: initials(name), avatarUrl: null, role: "employee",
        targetHours: 8, halfDayCutoff: null, password: String(password),
      };
      db.employees.push(emp);
      saveDb(db);
      return publicEmployee(emp);
    },

    // Archive of admin-removed employees (with added/deleted dates).
    async deletedEmployees() {
      await delay(40);
      const db = loadDb();
      requireUser(db);
      return db.deletedEmployees || [];
    },

    // Admin deletes an employee: snapshot to archive, then remove the employee
    // and cascade their attendance + leave records. Can't delete yourself.
    async deleteEmployee(id) {
      await delay();
      const db = loadDb();
      const admin = requireUser(db);
      if (admin.role !== "admin") throw new ApiError("Admins only", 403);
      const targetId = Number(id);
      if (targetId === admin.id) throw new ApiError("You can't delete your own account", 403);
      const emp = db.employees.find((e) => e.id === targetId);
      if (!emp) throw new ApiError("Employee not found", 404);
      db.deletedEmployees = db.deletedEmployees || [];
      db.deletedEmployees.unshift({
        ...publicEmployee(emp),
        addedAt: emp.joinDate,
        deletedAt: new Date().toISOString(),
      });
      db.employees = db.employees.filter((e) => e.id !== targetId);
      // Attendance + leave records are PRESERVED (not removed) so admins keep
      // the full history for the deleted user's lifecycle (audit/reporting).
      saveDb(db);
      return { ok: true, id: targetId };
    },

    async myAttendance() {
      await delay(40);
      const db = loadDb();
      const emp = requireUser(db);
      const rec = todayRecord(db, emp.id);
      return summarize(rec?.sessions || [], emp.targetHours);
    },

    async clockIn(location = "office") {
      await delay();
      const db = loadDb();
      const emp = requireUser(db);
      const loc = location === "remote" ? "remote" : "office";
      const rec = todayRecord(db, emp.id, { create: true });
      if (isClockedIn(rec)) throw new ApiError("You are already clocked in", 409);
      rec.sessions.push({ in: new Date().toISOString(), out: null, location: loc });
      saveDb(db);
      return summarize(rec.sessions, emp.targetHours);
    },

    async clockOut() {
      await delay();
      const db = loadDb();
      const emp = requireUser(db);
      const rec = todayRecord(db, emp.id);
      const open = rec?.sessions.find((s) => s.out === null);
      if (!open) throw new ApiError("You are not clocked in", 409);
      open.out = new Date().toISOString();
      saveDb(db);
      return summarize(rec.sessions, emp.targetHours);
    },

    async resetAttendance() {
      await delay();
      const db = loadDb();
      const emp = requireUser(db);
      const rec = todayRecord(db, emp.id);
      if (rec) rec.sessions = [];
      saveDb(db);
      return summarize(rec?.sessions || [], emp.targetHours);
    },

    // Today's per-employee log, scoped to who the caller may see.
    async attendanceToday() {
      await delay();
      const db = loadDb();
      const me = requireUser(db);
      const ids = visibleIds(db, me);
      return db.employees.filter((e) => ids.has(e.id)).map((emp) => {
        const rec = todayRecord(db, emp.id);
        const s = summarize(rec?.sessions || [], emp.targetHours);
        return {
          employeeId: emp.id, clockIn: s.firstIn, clockOut: s.lastOut,
          workedSec: s.workedSec,
          status: s.clockedIn ? "Working" : s.sessions.length ? "Present" : "Absent",
        };
      });
    },

    // Full month breakdown for the signed-in employee. month is 1-12.
    async monthlyAttendance({ year, month } = {}) {
      await delay();
      const db = loadDb();
      const emp = requireUser(db);
      const now = new Date();
      return monthlyForEmployee({
        year: year || now.getFullYear(),
        month: month || now.getMonth() + 1,
        employee: emp, records: db.attendance, leaves: db.leaves, settings: db.settings,
      });
    },

    // Per-employee totals + weekend list for the whole team (admin). month is 1-12.
    // Includes FORMER (deleted) employees so admins keep complete history; each
    // former row is bounded by its deletion date (endDate) and flagged deleted.
    async monthlyTeam({ year, month } = {}) {
      await delay();
      const db = loadDb();
      const emp = requireUser(db);
      if (!canApprove(emp)) throw new ApiError("Managers or admins only", 403);
      const now = new Date();
      // Admin sees everyone (plus former employees for history); a manager sees
      // only their own reports.
      const roster = emp.role === "admin"
        ? [...db.employees, ...(db.deletedEmployees || []).map((d) => ({
            ...d, endDate: dateKey(new Date(d.deletedAt)), deleted: true,
          }))]
        : reportsOf(db, emp.id);
      return monthlyForTeam({
        year: year || now.getFullYear(),
        month: month || now.getMonth() + 1,
        employees: roster, records: db.attendance, leaves: db.leaves, settings: db.settings,
      });
    },

    // Admin → all; manager → self + reports; employee → own.
    async leaves() {
      await delay();
      const db = loadDb();
      const emp = requireUser(db);
      const ids = visibleIds(db, emp);
      return db.leaves.filter((l) => ids.has(l.employeeId));
    },

    async applyLeave(payload = {}) {
      await delay();
      const db = loadDb();
      const emp = requireUser(db);
      const { type, from, to, reason } = payload;
      // Validate dates, overlaps and remaining balance against this user's leaves.
      const check = validateLeaveRequest(db.leaves.filter((l) => l.employeeId === emp.id), emp.id, { type, from, to });
      if (!check.ok) throw new ApiError(check.error, 400);
      const leave = {
        id: db._nextLeaveId++, employeeId: emp.id, type, from, to,
        days: check.days, status: "Pending", reason: reason || "",
      };
      db.leaves.push(leave);
      saveDb(db);
      return leave;
    },

    async setLeaveStatus(id, status) {
      await delay();
      const db = loadDb();
      const emp = requireUser(db);
      if (!canApprove(emp)) throw new ApiError("You can't approve leave", 403);
      if (!["Approved", "Rejected", "Pending"].includes(status)) {
        throw new ApiError("Invalid status", 400);
      }
      const leave = db.leaves.find((l) => l.id === Number(id));
      if (!leave) throw new ApiError("Leave not found", 404);
      if (leave.employeeId === emp.id) throw new ApiError("You can't approve your own leave", 403);
      // Managers may only act on their own reports' requests.
      if (emp.role === "manager" && !reportsOf(db, emp.id).some((r) => r.id === leave.employeeId)) {
        throw new ApiError("That request isn't from one of your reports", 403);
      }
      leave.status = status;
      saveDb(db);
      return leave;
    },

    // ---- Attendance regularizations --------------------------------------
    // Scoped list: admin → all; manager → self + reports; employee → own.
    async regularizations() {
      await delay();
      const db = loadDb();
      const emp = requireUser(db);
      const ids = visibleIds(db, emp);
      return (db.regularizations || []).filter((r) => ids.has(r.employeeId));
    },

    // Request a correction for a past day (forgot to punch, wrong time, etc.).
    async applyRegularization(payload = {}) {
      await delay();
      const db = loadDb();
      const emp = requireUser(db);
      const { date, in: inTime, out: outTime, reason } = payload;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ""))) throw new ApiError("A valid date is required", 400);
      if (date > dateKey()) throw new ApiError("You can only regularize a past day", 400);
      if (!inTime || !outTime) throw new ApiError("Both a clock-in and clock-out time are required", 400);
      if (new Date(outTime) <= new Date(inTime)) throw new ApiError("Clock-out must be after clock-in", 400);
      if ((db.regularizations || []).some((r) => r.employeeId === emp.id && r.date === date && r.status === "Pending")) {
        throw new ApiError("You already have a pending request for that day", 409);
      }
      const reg = {
        id: db._nextRegId++, employeeId: emp.id, date,
        in: inTime, out: outTime, reason: reason || "", status: "Pending",
      };
      db.regularizations = db.regularizations || [];
      db.regularizations.push(reg);
      saveDb(db);
      return reg;
    },

    // Approve/reject a regularization. Approving rewrites that day's attendance.
    async setRegularizationStatus(id, status) {
      await delay();
      const db = loadDb();
      const emp = requireUser(db);
      if (!canApprove(emp)) throw new ApiError("You can't review regularizations", 403);
      if (!["Approved", "Rejected", "Pending"].includes(status)) throw new ApiError("Invalid status", 400);
      const reg = (db.regularizations || []).find((r) => r.id === Number(id));
      if (!reg) throw new ApiError("Request not found", 404);
      if (reg.employeeId === emp.id) throw new ApiError("You can't approve your own request", 403);
      if (emp.role === "manager" && !reportsOf(db, emp.id).some((r) => r.id === reg.employeeId)) {
        throw new ApiError("That request isn't from one of your reports", 403);
      }
      reg.status = status;
      if (status === "Approved") applyRegularization(db.attendance, reg);
      saveDb(db);
      return reg;
    },
  };
}
