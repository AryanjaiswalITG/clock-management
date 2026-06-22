// App data store. Two persistence backends, chosen at runtime:
//
//  - Postgres (when DATABASE_URL is set, e.g. a free Neon database): the ENTIRE
//    app state is stored as a single JSON document in an app_state table, so it
//    survives redeploys and Render's ephemeral disk. This keeps the exact same
//    in-memory object model the rest of the server already uses — no schema or
//    route changes — while making created accounts/leaves/etc. durable.
//  - JSON file (no DATABASE_URL): writes server/data.json. Great for local dev.
//
// On first run with an empty database it seeds the demo org, hashes passwords,
// and persists. After that, the stored state is the source of truth.
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

// ---- Optional Postgres backend ---------------------------------------------
const USE_PG = !!process.env.DATABASE_URL;
let pool = null;
async function pg() {
  if (!pool) {
    const { Pool } = await import("pg"); // lazy: only needed when DATABASE_URL is set
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // Managed Postgres (Neon/Supabase/Render) require SSL.
      ssl: process.env.PGSSL === "disable" ? false : { rejectUnauthorized: false },
    });
  }
  return pool;
}

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

// Defensively backfill fields added in later versions onto an existing store, so
// older persisted data keeps working. Returns true if anything changed.
function migrate(d) {
  let migrated = false;
  if (!d.settings) { d.settings = { companyName: "Northwind" }; migrated = true; }
  if (!Array.isArray(d.settings.weekendDays)) { d.settings.weekendDays = DEFAULT_WEEKEND_DAYS; migrated = true; }
  if (!Array.isArray(d.settings.holidays)) { d.settings.holidays = []; migrated = true; }
  if (!Array.isArray(d.deletedEmployees)) { d.deletedEmployees = []; migrated = true; }
  if (!Array.isArray(d.regularizations)) { d.regularizations = []; migrated = true; }
  if (typeof d._nextRegId !== "number") { d._nextRegId = 1; migrated = true; }
  if (!Array.isArray(d.notifications)) { d.notifications = []; migrated = true; }
  if (typeof d._nextNotifId !== "number") { d._nextNotifId = 1; migrated = true; }
  for (const e of d.employees) {
    if (!("halfDayCutoff" in e)) { e.halfDayCutoff = null; migrated = true; }
    // Backfill account-creation timestamp for older records, derived from
    // joinDate, so the "Newly" badge works without losing existing data.
    if (!e.createdAt && e.joinDate) { e.createdAt = `${e.joinDate}T00:00:00.000Z`; migrated = true; }
  }
  // Safety net: guarantee a known active-admin login always exists, so the org
  // can never be locked out of employee management (a demoted/removed last admin
  // otherwise makes every admin route 403 for everyone, with no way back in).
  // The credentials are intentionally well-known — this is a public demo app
  // (see DEFAULT_PASSWORD, which is likewise committed and publicly exposed).
  const FALLBACK_ADMIN_EMAIL = "newadmin@demo.com";
  const fa = d.employees.find((e) => e.email?.toLowerCase() === FALLBACK_ADMIN_EMAIL);
  if (!fa) {
    const id = d.employees.reduce((max, e) => Math.max(max, e.id), 0) + 1;
    d.employees.push({
      id, name: "new admin", designation: "Administrator",
      deptId: d.departments[0]?.id ?? 1, managerId: null,
      email: FALLBACK_ADMIN_EMAIL, joinDate: dateKey(), status: "Active",
      avatar: "NA", avatarUrl: null, role: "admin",
      targetHours: 8, halfDayCutoff: null, createdAt: new Date().toISOString(),
      passwordHash: bcrypt.hashSync("123456", 10),
    });
    migrated = true;
  } else if (fa.role !== "admin" || fa.status !== "Active") {
    // Keep it usable even if it was later demoted/deactivated.
    fa.role = "admin";
    fa.status = "Active";
    migrated = true;
  }
  return migrated;
}

let db;

export async function load() {
  if (db) return db;
  if (USE_PG) {
    const p = await pg();
    await p.query(`CREATE TABLE IF NOT EXISTS app_state (id INT PRIMARY KEY, data JSONB NOT NULL)`);
    const r = await p.query(`SELECT data FROM app_state WHERE id = 1`);
    if (r.rows[0]) {
      db = r.rows[0].data;
      if (migrate(db)) await persistNow();
    } else {
      db = seedDatabase();
      await persistNow();
    }
    return db;
  }
  // File fallback (local dev / no DATABASE_URL).
  if (fs.existsSync(DATA_FILE)) {
    db = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    if (migrate(db)) save();
  } else {
    db = seedDatabase();
    save();
  }
  return db;
}

// Write the whole state to Postgres (awaited form).
async function persistNow() {
  const p = await pg();
  await p.query(
    `INSERT INTO app_state (id, data) VALUES (1, $1::jsonb)
     ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
    [JSON.stringify(db)]
  );
}

// Synchronous-looking save used throughout the routes. With Postgres it persists
// asynchronously (fire-and-forget; errors logged) — writes complete in a few ms
// and a SIGTERM flush (below) covers redeploys. With the file backend it writes
// data.json synchronously as before.
export function save() {
  if (USE_PG) {
    persistNow().catch((e) => console.error("DB persist failed:", e.message));
    return;
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

// Best-effort final flush before the process exits (Render sends SIGTERM on
// redeploy), so the last write isn't lost.
export async function flush() {
  if (USE_PG && db) {
    try { await persistNow(); } catch (e) { console.error("DB flush failed:", e.message); }
  }
}
