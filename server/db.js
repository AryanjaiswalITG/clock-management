// Tiny JSON-file "database". On first run it seeds from the original mock data,
// hashes passwords, and writes data.json. After that, data.json is the source of truth
// so clock-in/out punches and leave decisions persist across restarts.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import { dateKey, DEFAULT_WEEKEND_DAYS } from "../shared/attendance.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "data.json");

// Default password for every seeded account (demo only).
export const DEFAULT_PASSWORD = "password123";

// Single-sourced from shared/, re-exported so `import { dateKey } from "./db.js"` still works.
export { dateKey };

const departments = [
  { id: 1, name: "Engineering" },
  { id: 2, name: "Product" },
  { id: 3, name: "People & HR" },
  { id: 4, name: "Sales" },
  { id: 5, name: "Finance" },
];

// role: "admin" sees the full org dashboard, "employee" sees only their own view.
// Single demo account.
// halfDayCutoff: "HH:MM" local time. If set and the employee's first check-in is
// after it, the day is auto-marked Half Day. null = no half-day rule.
const seedEmployees = [
  { id: 1, name: "Aryan Jaiswal", designation: "Developer", deptId: 1, managerId: null, email: "aryanjaiswal@demo.do", joinDate: "2024-01-15", status: "Active", avatar: "AJ", avatarUrl: null, role: "employee", targetHours: 8, halfDayCutoff: "13:00" },
];

const seedLeaves = [];

const attendanceTrend = [
  { day: "Mon", present: 7, absent: 1 },
  { day: "Tue", present: 8, absent: 0 },
  { day: "Wed", present: 6, absent: 2 },
  { day: "Thu", present: 7, absent: 1 },
  { day: "Fri", present: 6, absent: 2 },
];

// Start each demo with a clean day — the user clocks in/out themselves.
function seedAttendance() {
  return [];
}

function seedDatabase() {
  const employees = seedEmployees.map((e) => ({
    ...e,
    passwordHash: bcrypt.hashSync(DEFAULT_PASSWORD, 10),
  }));
  return {
    departments,
    employees,
    leaves: seedLeaves,
    attendance: seedAttendance(),
    attendanceTrend,
    settings: { companyName: "Northwind", weekendDays: DEFAULT_WEEKEND_DAYS, holidays: [] },
    _nextLeaveId: seedLeaves.length + 1,
  };
}

let db;

export function load() {
  if (db) return db;
  if (fs.existsSync(DATA_FILE)) {
    db = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    // Migrate older data files that predate newer fields.
    let migrated = false;
    if (!db.settings) { db.settings = { companyName: "Northwind" }; migrated = true; }
    if (!Array.isArray(db.settings.weekendDays)) { db.settings.weekendDays = DEFAULT_WEEKEND_DAYS; migrated = true; }
    if (!Array.isArray(db.settings.holidays)) { db.settings.holidays = []; migrated = true; }
    for (const e of db.employees) {
      if (!("halfDayCutoff" in e)) { e.halfDayCutoff = null; migrated = true; }
    }
    if (migrated) save();
  } else {
    db = seedDatabase();
    save();
  }
  return db;
}

export function save() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}
