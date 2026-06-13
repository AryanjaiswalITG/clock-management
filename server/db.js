// Tiny JSON-file "database". On first run it seeds from the original mock data,
// hashes passwords, and writes data.json. After that, data.json is the source of truth
// so clock-in/out punches and leave decisions persist across restarts.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import { dateKey, DEFAULT_WEEKEND_DAYS } from "../shared/attendance.js";
import { buildDemoData, SEED_VERSION } from "../shared/demoSeed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "data.json");

// Default password for every seeded account (demo only).
export const DEFAULT_PASSWORD = "password123";

// Single-sourced from shared/, re-exported so `import { dateKey } from "./db.js"` still works.
export { dateKey };

// Build a fresh demo DB: shared profiles/attendance/leaves + bcrypt password hashes.
function seedDatabase() {
  const data = buildDemoData(new Date());
  return {
    departments: data.departments,
    employees: data.employees.map((e) => ({ ...e, passwordHash: bcrypt.hashSync(DEFAULT_PASSWORD, 10) })),
    leaves: data.leaves,
    attendance: data.attendance,
    regularizations: data.regularizations,
    deletedEmployees: [],
    notifications: [],
    settings: { companyName: "Northwind", weekendDays: DEFAULT_WEEKEND_DAYS, holidays: data.holidays },
    _nextLeaveId: data._nextLeaveId,
    _nextRegId: data._nextRegId,
    _nextNotifId: 1,
    _seedVersion: SEED_VERSION,
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
    if (!Array.isArray(db.deletedEmployees)) { db.deletedEmployees = []; migrated = true; }
    if (!Array.isArray(db.regularizations)) { db.regularizations = []; migrated = true; }
    if (typeof db._nextRegId !== "number") { db._nextRegId = 1; migrated = true; }
    if (!Array.isArray(db.notifications)) { db.notifications = []; migrated = true; }
    if (typeof db._nextNotifId !== "number") { db._nextNotifId = 1; migrated = true; }
    for (const e of db.employees) {
      if (!("halfDayCutoff" in e)) { e.halfDayCutoff = null; migrated = true; }
      // Backfill account-creation timestamp for older records, derived from
      // joinDate, so the "Newly" badge works without losing existing data.
      if (!e.createdAt && e.joinDate) { e.createdAt = `${e.joinDate}T00:00:00.000Z`; migrated = true; }
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
