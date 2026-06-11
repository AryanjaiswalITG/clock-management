# SQL backend (optional, "switch on later")

The live app runs **without** a database — the browser build uses an in-browser
`localStorage` backend (`src/mockApi.js`) and local dev uses a JSON file
(`server/db.js`). This folder is the **ready-to-run SQL path** for when you want
real, shared, persistent storage.

It uses the **same** attendance logic as the rest of the app
(`shared/attendance.js`), so SQL results match the mock/JSON results exactly.

## What's here

| File | Purpose |
|------|---------|
| `schema.sql` | Full schema snapshot (one-shot apply) |
| `migrations/0001_init.sql` | Tables + indexes (idempotent) |
| `migrations/0002_seed.sql` | Departments, settings, demo account (`aryanjaiswal@demo.do` / `password123`) |
| `../server/sqlDb.js` | Postgres adapter: query helpers + automated daily-status job |

## Schema overview

- **employees** — profiles, incl. `half_day_cutoff TIME` (the Half-Day Cutoff setting)
- **settings** — `company_name`, `weekend_days INTEGER[]` (0=Sun … 6=Sat)
- **holidays** — `holiday_date` list
- **attendance_sessions** — raw clock-in/out punches
- **daily_attendance** — one computed row per employee per day (Present / Half Day / Absent / Leave / Weekend / Holiday) — written by the end-of-day job
- **leaves** — leave requests + status
- **monthly_summary** — per-employee monthly rollup for fast reports

## Setup

```bash
# 1. Provision a Postgres DB (Neon / Supabase / Render all have free tiers).
# 2. Apply the schema:
psql "$DATABASE_URL" -f sql/schema.sql
psql "$DATABASE_URL" -f sql/migrations/0002_seed.sql

# 3. Install the driver in the server package:
cd server && npm i pg

# 4. Point the server at the DB:
export DATABASE_URL="postgres://user:pass@host:5432/dbname"
```

`server/sqlDb.js` can also create the tables for you:

```js
import { runMigrations } from "./sqlDb.js";
await runMigrations(); // runs every sql/migrations/*.sql in order
```

## Wiring it into the API

`server/index.js` currently calls the JSON store (`server/db.js`). To go SQL,
replace those reads/writes with the async functions from `sqlDb.js`
(`getEmployees`, `getEmployeeByEmail`, `createEmployee`, `clockIn`, `clockOut`,
`getLeaves`, `getSettings`, `updateSettings`, …). A clean approach is to branch
on an env flag:

```js
const useSql = process.env.DB_DRIVER === "sql";
```

## Automated end-of-day status (Rules 1 & 2)

`summarizeAndStoreDaily(employeeId, date)` computes one day's status using the
shared rules:

- **Rule 1 — Half Day:** a `half_day_cutoff` is set and the first check-in is
  after it.
- **Rule 2 — Absent:** no check-in on a past working day (and not on leave).

Run it nightly for everyone, e.g. with a cron job:

```js
import { getEmployees, summarizeAndStoreDaily, recomputeMonth } from "./sqlDb.js";

// 00:05 every day — finalise yesterday for all employees:
for (const e of await getEmployees()) await summarizeAndStoreDaily(e.id, yesterday);

// Or refresh a whole month + the monthly_summary rollup:
await recomputeMonth(2026, 6);
```

The same statuses then power the dashboards and reports.
