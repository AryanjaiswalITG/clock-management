// Northwind HR API server.
// Run: cd server && npm install && npm start  (listens on :4000)
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import path from "path";
import { fileURLToPath } from "url";

import { load, save, DEFAULT_PASSWORD, dateKey } from "./db.js";
import { signToken, requireAuth, requireAdmin, setAuthCookie, clearAuthCookie } from "./auth.js";
import { todayRecord, isClockedIn, summarize } from "./attendance.js";

const db = load();
const app = express();
// CORS: allow the frontend origin(s) to send credentials cross-origin.
// Set CORS_ORIGIN on Render to your GitHub Pages origin (scheme + host, NO path),
// e.g. "https://aryanjaiswalitg.github.io". Comma-separate for multiple origins.
// If unset, any origin is reflected (convenient for local dev).
const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : true,
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json({ limit: "6mb" })); // headroom for base64 profile images

// Strip the password hash before sending an employee to the client.
const publicEmployee = ({ passwordHash, ...rest }) => rest;
const findEmployee = (id) => db.employees.find((e) => e.id === id);

// "Aryan Jaiswal" -> "AJ"  (first letters of first two words, fallback to first 2 chars)
function initials(name) {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return String(name).trim().slice(0, 2).toUpperCase() || "?";
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---- Auth -------------------------------------------------------------------

// POST /api/auth/login { email, password } -> { token, user }
// Wrong credentials => 401, which the frontend turns into a "retry" popup.
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }
  const emp = db.employees.find(
    (e) => e.email.toLowerCase() === String(email).toLowerCase()
  );
  if (!emp || !bcrypt.compareSync(password, emp.passwordHash)) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  const token = signToken(emp);
  setAuthCookie(res, token);
  res.json({ token, user: publicEmployee(emp) });
});

// POST /api/auth/register { name, email, password } -> creates an employee and
// signs them in (sets the session cookie), so they land straight on the app.
app.post("/api/auth/register", (req, res) => {
  const { name, email, password } = req.body || {};
  const trimmedName = String(name || "").trim();
  const trimmedEmail = String(email || "").trim().toLowerCase();

  if (!trimmedName) return res.status(400).json({ error: "Full name is required" });
  if (!EMAIL_RE.test(trimmedEmail)) return res.status(400).json({ error: "Please enter a valid email address" });
  if (!password || String(password).length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }
  if (db.employees.some((e) => e.email.toLowerCase() === trimmedEmail)) {
    return res.status(409).json({ error: "An account with this email already exists" });
  }

  const id = db.employees.reduce((max, e) => Math.max(max, e.id), 0) + 1;
  const emp = {
    id,
    name: trimmedName,
    designation: "Employee",
    deptId: db.departments[0]?.id ?? 1,
    managerId: null,
    email: trimmedEmail,
    joinDate: dateKey(),
    status: "Active",
    avatar: initials(trimmedName),
    avatarUrl: null,
    role: "employee",
    targetHours: 8,
    passwordHash: bcrypt.hashSync(String(password), 10),
  };
  db.employees.push(emp);
  save();

  const token = signToken(emp);
  setAuthCookie(res, token);
  res.status(201).json({ token, user: publicEmployee(emp) });
});

// POST /api/auth/logout -> clear the session cookie.
app.post("/api/auth/logout", (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

// GET /api/demo-account -> public hint for the login screen, kept in sync with
// the seeded account so the email shown is never stale.
app.get("/api/demo-account", (req, res) => {
  const first = db.employees[0];
  res.json({ email: first?.email || "", password: DEFAULT_PASSWORD });
});

// ---- Org settings (company name) -------------------------------------------

// Public so the login screen can show the company brand.
app.get("/api/settings", (req, res) => {
  res.json(db.settings);
});

// Update the company name (any authenticated user, for this demo).
app.patch("/api/settings", requireAuth, (req, res) => {
  const { companyName } = req.body || {};
  if (companyName !== undefined) {
    const trimmed = String(companyName).trim();
    if (!trimmed) return res.status(400).json({ error: "Company name cannot be empty" });
    if (trimmed.length > 40) return res.status(400).json({ error: "Company name is too long" });
    db.settings.companyName = trimmed;
  }
  save();
  res.json(db.settings);
});

// GET /api/me -> the logged-in user's profile
app.get("/api/me", requireAuth, (req, res) => {
  const emp = findEmployee(req.auth.sub);
  if (!emp) return res.status(404).json({ error: "User not found" });
  res.json(publicEmployee(emp));
});

// PATCH /api/me -> update own editable profile fields.
// Editable: name, designation, email, deptId, targetHours.
// Intentionally NOT editable: role, joinDate, id, status.
app.patch("/api/me", requireAuth, (req, res) => {
  const emp = findEmployee(req.auth.sub);
  if (!emp) return res.status(404).json({ error: "User not found" });
  const { name, designation, email, deptId, targetHours, avatarUrl } = req.body || {};

  if (name !== undefined) {
    const trimmed = String(name).trim();
    if (!trimmed) return res.status(400).json({ error: "Name cannot be empty" });
    emp.name = trimmed;
    emp.avatar = initials(trimmed); // keep initials in sync with the name
  }

  if (designation !== undefined) {
    const trimmed = String(designation).trim();
    if (!trimmed) return res.status(400).json({ error: "Designation cannot be empty" });
    emp.designation = trimmed;
  }

  if (email !== undefined) {
    const trimmed = String(email).trim().toLowerCase();
    if (!EMAIL_RE.test(trimmed)) return res.status(400).json({ error: "Please enter a valid email address" });
    const taken = db.employees.some((e) => e.id !== emp.id && e.email.toLowerCase() === trimmed);
    if (taken) return res.status(409).json({ error: "That email is already in use" });
    emp.email = trimmed;
  }

  if (deptId !== undefined) {
    const id = Number(deptId);
    if (!db.departments.some((d) => d.id === id)) {
      return res.status(400).json({ error: "Unknown department" });
    }
    emp.deptId = id;
  }

  if (targetHours !== undefined) {
    const t = Number(targetHours);
    if (!Number.isFinite(t) || t < 1 || t > 24) {
      return res.status(400).json({ error: "Daily target must be between 1 and 24 hours" });
    }
    emp.targetHours = t;
  }

  // Profile photo: a data:image URL, or null to remove it.
  if (avatarUrl !== undefined) {
    if (avatarUrl === null || avatarUrl === "") {
      emp.avatarUrl = null;
    } else {
      if (typeof avatarUrl !== "string" || !avatarUrl.startsWith("data:image/")) {
        return res.status(400).json({ error: "Profile photo must be an image" });
      }
      if (avatarUrl.length > 5_000_000) {
        return res.status(400).json({ error: "Image is too large (max ~3.5 MB)" });
      }
      emp.avatarUrl = avatarUrl;
    }
  }

  save();
  res.json(publicEmployee(emp));
});

// ---- Reference / directory data --------------------------------------------

app.get("/api/departments", requireAuth, (req, res) => {
  res.json(db.departments);
});

// Full directory — admins only.
app.get("/api/employees", requireAuth, requireAdmin, (req, res) => {
  res.json(db.employees.map(publicEmployee));
});

// ---- Attendance: my own ----------------------------------------------------

// GET /api/attendance/me -> today's summary (worked/away/target + sessions)
app.get("/api/attendance/me", requireAuth, (req, res) => {
  const emp = findEmployee(req.auth.sub);
  const rec = todayRecord(db, emp.id);
  const summary = summarize(rec?.sessions || [], emp.targetHours);
  res.json(summary);
});

// POST /api/attendance/clock-in
app.post("/api/attendance/clock-in", requireAuth, (req, res) => {
  const emp = findEmployee(req.auth.sub);
  const rec = todayRecord(db, emp.id, { create: true });
  if (isClockedIn(rec)) {
    return res.status(409).json({ error: "You are already clocked in" });
  }
  rec.sessions.push({ in: new Date().toISOString(), out: null });
  save();
  res.json(summarize(rec.sessions, emp.targetHours));
});

// POST /api/attendance/clock-out
app.post("/api/attendance/clock-out", requireAuth, (req, res) => {
  const emp = findEmployee(req.auth.sub);
  const rec = todayRecord(db, emp.id);
  const open = rec?.sessions.find((s) => s.out === null);
  if (!open) {
    return res.status(409).json({ error: "You are not clocked in" });
  }
  open.out = new Date().toISOString();
  save();
  res.json(summarize(rec.sessions, emp.targetHours));
});

// POST /api/attendance/reset -> clear today's sessions and start the day over.
// Wipes any in-progress or completed sessions for today so the worked/target
// timer returns to its initial state. The configured daily target is untouched.
app.post("/api/attendance/reset", requireAuth, (req, res) => {
  const emp = findEmployee(req.auth.sub);
  const rec = todayRecord(db, emp.id);
  if (rec) rec.sessions = [];
  save();
  res.json(summarize(rec?.sessions || [], emp.targetHours));
});

// ---- Attendance: whole team (admin) ----------------------------------------

// GET /api/attendance/today -> per-employee summary for the admin log
app.get("/api/attendance/today", requireAuth, requireAdmin, (req, res) => {
  const rows = db.employees.map((emp) => {
    const rec = todayRecord(db, emp.id);
    const s = summarize(rec?.sessions || [], emp.targetHours);
    return {
      employeeId: emp.id,
      clockIn: s.firstIn,
      clockOut: s.lastOut,
      workedSec: s.workedSec,
      status: s.clockedIn ? "Working" : s.sessions.length ? "Present" : "Absent",
    };
  });
  res.json(rows);
});

// ---- Leaves ----------------------------------------------------------------

// Admins see all requests; employees see only their own.
app.get("/api/leaves", requireAuth, (req, res) => {
  if (req.auth.role === "admin") return res.json(db.leaves);
  res.json(db.leaves.filter((l) => l.employeeId === req.auth.sub));
});

// Apply for leave (any authenticated user, for themselves).
app.post("/api/leaves", requireAuth, (req, res) => {
  const { type, from, to, days, reason } = req.body || {};
  if (!type || !from || !to) {
    return res.status(400).json({ error: "type, from and to are required" });
  }
  const leave = {
    id: db._nextLeaveId++,
    employeeId: req.auth.sub,
    type,
    from,
    to,
    days: Number(days) || 1,
    status: "Pending",
    reason: reason || "",
  };
  db.leaves.push(leave);
  save();
  res.status(201).json(leave);
});

// Approve / reject — admins only.
app.patch("/api/leaves/:id", requireAuth, requireAdmin, (req, res) => {
  const { status } = req.body || {};
  if (!["Approved", "Rejected", "Pending"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }
  const leave = db.leaves.find((l) => l.id === Number(req.params.id));
  if (!leave) return res.status(404).json({ error: "Leave not found" });
  leave.status = status;
  save();
  res.json(leave);
});

// ---- Serve the built frontend (single-origin deploy) -----------------------
// In production the Vite build output (../dist) is served by this same server,
// so the app and its API share one origin. Any non-API route returns index.html
// so client-side (React Router) routes work on refresh / deep links.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.join(__dirname, "..", "dist");
app.use(express.static(distPath));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next(); // let unknown API routes 404
  res.sendFile(path.join(distPath, "index.html"));
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Northwind HR API running on http://localhost:${PORT}`);
  console.log(`Demo login: ${db.employees[0]?.email} / password "${DEFAULT_PASSWORD}"`);
});
