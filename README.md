# Northwind HR — Keka-style HRMS (React + Node)

A full-stack HRMS with **role-based login**. Employees track their own work day;
admins (HR) manage the whole org.

## What's inside

**Frontend** (React + Vite) and **Backend** (Node + Express) with real JWT auth.

### Login & roles
- Sign in with email + password. Credentials are checked **on the server** (bcrypt-hashed).
- Wrong password → a **retry popup** appears (no page reload).
- After login you land on a view based on your role:
  - **Employee** → personal dashboard
  - **Admin (HR)** → the full org dashboard

### Employee view
- **My Attendance** — live clock, **Clock In / Clock Out**, and:
  - **Worked today** vs an 8-hour **target** (live progress bar + remaining/overtime)
  - **Away / Break** time (the gaps between clock-out and the next clock-in)
  - every session of the day in a table
- **My Profile** — your details on file.

### Admin view
- **Dashboard** — headcount, weekly attendance, department pie, pending approvals
- **Employees** — searchable directory with department filters
- **Org Chart** — manager → reports hierarchy
- **Attendance** — today's team log (live, from the backend)
- **Leave** — approve / decline workflow (persists to the backend)
- **Payroll** — salary breakdown

## Run locally

Open **two terminals**.

**1. Backend** (port 4000):
```bash
cd server
npm install
npm start
```

**2. Frontend** (port 5173):
```bash
npm install
npm run dev
```
Open the URL Vite prints (http://localhost:5173). The frontend proxies `/api/*`
to the backend automatically.

## Demo accounts

Every account uses the password **`password123`**.

| Email | Role |
|-------|------|
| `meera@northwind.co` | Admin (HR) |
| `diya@northwind.co` | Employee |
| `aarav@northwind.co`, `kabir@northwind.co`, `ishaan@northwind.co`, `ananya@northwind.co`, `rohan@northwind.co`, `sara@northwind.co` | Employee |

## Stack
React 19, Vite, React Router, Recharts, lucide-react · Express, jsonwebtoken, bcryptjs.

Backend data is seeded into `server/data.json` on first run (gitignored). Delete that
file to reset to the original seed.

## API (backend)
- `POST /api/auth/login` → `{ token, user }` (401 on bad credentials)
- `GET  /api/me` — current user
- `GET  /api/attendance/me` — today's worked/away/target summary
- `POST /api/attendance/clock-in` · `POST /api/attendance/clock-out`
- `GET  /api/employees` *(admin)* · `GET /api/attendance/today` *(admin)*
- `GET  /api/leaves` · `POST /api/leaves` · `PATCH /api/leaves/:id` *(admin)*
