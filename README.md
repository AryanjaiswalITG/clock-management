# Northwind HR — Keka-style HRMS (React + Node)

A full-stack HRMS with **role-based login**. Employees track their own work day;
admins (HR) manage the whole org.

## 🔗 Live demo

**https://clock-management.onrender.com** — *(confirm your exact URL on the Render dashboard after deploying; it follows the service name)*

> Hosted on Render's free tier: the **first request after idle can take ~30s** while
> the service wakes up. Create your own account on the **Sign up** screen, or use the
> seeded demo login below.

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
Open the URL Vite prints (http://localhost:5173). In dev the frontend proxies
`/api/*` to the backend on port 4000 automatically (see `vite.config.js`).

## Deploy (single-origin, one URL)

The Express server serves the built React app **and** the `/api` routes from one
origin, so the whole app deploys as a single web service — no CORS, no separate
frontend host.

1. Push to GitHub (already done for this repo).
2. On [Render](https://dashboard.render.com): **New + → Blueprint →** select this
   repo **→ Apply**. Render reads [`render.yaml`](render.yaml), which:
   - builds the frontend (`npm run build` → `dist/`),
   - installs the server deps, and
   - starts `node server/index.js` (serves `dist/` + `/api`).
3. Render sets `NODE_ENV=production` and generates a `JWT_SECRET` automatically.
4. Open the URL Render gives you — that's your shareable link.

> Free tier notes: the service sleeps after ~15 min idle (~30s cold start), and
> the disk is ephemeral, so seeded/created data resets on each redeploy.

## Demo accounts

A fresh deploy seeds **one** account (the full directory lives in `server/data.json`,
which is gitignored). New visitors can **register their own account** from the
**Sign up** screen.

| Email | Password | Role |
|-------|----------|------|
| `aryanjaiswal@demo.do` | `password123` | Employee |

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
