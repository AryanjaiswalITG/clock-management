// Demo seed data shared by the browser mock (src/mockApi.js) and the Express
// JSON store (server/db.js). Profiles only — each backend attaches its own
// password representation (mock: plaintext; server: bcrypt hash).
//
// Bump SEED_VERSION when this data changes to re-seed existing browsers.
export const SEED_VERSION = 3;

export const DEMO_DEPARTMENTS = [
  { id: 1, name: "Engineering" },
  { id: 2, name: "Product" },
  { id: 3, name: "People & HR" },
  { id: 4, name: "Sales" },
  { id: 5, name: "Finance" },
];

// Every demo account uses the password "password123".
// halfDayCutoff "13:00"/"13:30" enables the auto Half-Day rule for some people.
// Aryan is a MANAGER (role "manager"): Ananya (id 6) reports to him, so the
// manager experience — team view + approving a report's leave/regularization —
// has real data behind it on the demo.
export const DEMO_EMPLOYEES = [
  { id: 1, name: "Aryan Jaiswal", designation: "Engineering Lead", deptId: 1, managerId: 2, email: "aryanjaiswal@demo.do", joinDate: "2024-01-15", status: "Active", avatar: "AJ", avatarUrl: null, role: "manager", targetHours: 8, halfDayCutoff: "13:00" },
  { id: 2, name: "Meera Nair", designation: "HR Manager", deptId: 3, managerId: null, email: "admin@demo.do", joinDate: "2022-03-01", status: "Active", avatar: "MN", avatarUrl: null, role: "admin", targetHours: 8, halfDayCutoff: null },
  { id: 3, name: "Kabir Singh", designation: "Product Designer", deptId: 2, managerId: 2, email: "kabir@demo.do", joinDate: "2023-06-10", status: "Active", avatar: "KS", avatarUrl: null, role: "employee", targetHours: 8, halfDayCutoff: "13:00" },
  { id: 4, name: "Diya Sharma", designation: "Sales Executive", deptId: 4, managerId: 2, email: "diya@demo.do", joinDate: "2023-09-05", status: "Active", avatar: "DS", avatarUrl: null, role: "employee", targetHours: 8, halfDayCutoff: null },
  { id: 5, name: "Rohan Mehta", designation: "Accountant", deptId: 5, managerId: 2, email: "rohan@demo.do", joinDate: "2024-02-20", status: "Active", avatar: "RM", avatarUrl: null, role: "employee", targetHours: 8, halfDayCutoff: null },
  { id: 6, name: "Ananya Rao", designation: "Software Engineer", deptId: 1, managerId: 1, email: "ananya@demo.do", joinDate: "2024-04-01", status: "Active", avatar: "AR", avatarUrl: null, role: "employee", targetHours: 8, halfDayCutoff: "13:30" },
];

const pad = (n) => String(n).padStart(2, "0");
const dstr = (y, mo, d) => `${y}-${pad(mo + 1)}-${pad(d)}`;

// Generate attendance for the current month, day 1 .. yesterday, skipping
// weekends. Deterministic variety: mostly Present, some Half Day (late check-in
// for people with a cutoff), some Absent — so the monthly report looks real.
export function buildDemoAttendance(today = new Date()) {
  const y = today.getFullYear();
  const mo = today.getMonth();
  const records = [];
  for (const emp of DEMO_EMPLOYEES) {
    for (let day = 1; day < today.getDate(); day++) {
      const dow = new Date(y, mo, day).getDay();
      if (dow === 0 || dow === 6) continue; // weekend
      const r = (emp.id * 13 + day * 7) % 10;
      if (r === 0) continue; // ~10% absent (no record)
      let inH, inM, outH;
      if (r === 1) { inH = 14; inM = 10; outH = 18; }       // late -> Half Day (if cutoff set)
      else { inH = 9; inM = (emp.id * 7 + day) % 40; outH = 17 + ((emp.id + day) % 2); } // Present
      records.push({
        employeeId: emp.id,
        date: dstr(y, mo, day),
        sessions: [{
          in: new Date(y, mo, day, inH, inM, 0).toISOString(),
          out: new Date(y, mo, day, outH, 30, 0).toISOString(),
        }],
      });
    }
  }
  return records;
}

// Nearest weekday on/before a given day-of-month (so demo dates never land on a
// weekend, which would otherwise mask the status we're trying to show).
function pastWeekday(y, mo, day) {
  let d = new Date(y, mo, day);
  while (d.getMonth() === mo && (d.getDay() === 0 || d.getDay() === 6)) d.setDate(d.getDate() - 1);
  return dstr(y, mo, d.getDate());
}

// Demo leave requests spanning a few types/statuses so balances and approvals
// have real data: approved leave (shows on the calendar), a pending request for
// the admin queue, and a pending request from a manager's direct report.
export function buildDemoLeaves(today = new Date()) {
  const y = today.getFullYear();
  const mo = today.getMonth();
  const soon = (n) => dstr(y, mo, Math.min(28, today.getDate() + n));
  return [
    { id: 1, employeeId: 4, type: "Casual", from: dstr(y, mo, 2), to: dstr(y, mo, 3), days: 2, status: "Approved", reason: "Family function" },
    { id: 2, employeeId: 3, type: "Sick", from: soon(2), to: soon(2), days: 1, status: "Pending", reason: "Doctor visit" },
    { id: 3, employeeId: 6, type: "Casual", from: soon(4), to: soon(5), days: 2, status: "Pending", reason: "Personal work" }, // Ananya → manager Aryan approves
    { id: 4, employeeId: 1, type: "Annual", from: dstr(y, mo, 8), to: dstr(y, mo, 9), days: 2, status: "Approved", reason: "Short break" },
  ];
}

// Two company holidays this month so the holiday calendar isn't empty.
export function buildDemoHolidays(today = new Date()) {
  const y = today.getFullYear();
  const mo = today.getMonth();
  return [...new Set([dstr(y, mo, 15), dstr(y, mo, Math.min(28, today.getDate() + 9))])].sort();
}

// One pending attendance-regularization (a report forgot to clock out) so the
// manager/admin approval flow has something to act on.
export function buildDemoRegularizations(today = new Date()) {
  const y = today.getFullYear();
  const mo = today.getMonth();
  const date = pastWeekday(y, mo, Math.max(1, today.getDate() - 3));
  return [
    {
      id: 1, employeeId: 6, date,
      in: new Date(`${date}T09:15:00`).toISOString(),
      out: new Date(`${date}T18:00:00`).toISOString(),
      reason: "Forgot to clock out — was in the office until 6pm.",
      status: "Pending",
    },
  ];
}

// Full demo dataset (profiles + attendance + leaves + holidays + regularizations),
// minus passwords.
export function buildDemoData(today = new Date()) {
  return {
    departments: DEMO_DEPARTMENTS,
    // Seeded profiles get an explicit createdAt from their (historical) join
    // date so the "Newly" badge never lights up for the demo org — only for
    // accounts actually created after deployment.
    employees: DEMO_EMPLOYEES.map((e) => ({ ...e, createdAt: `${e.joinDate}T00:00:00.000Z` })),
    attendance: buildDemoAttendance(today),
    leaves: buildDemoLeaves(today),
    holidays: buildDemoHolidays(today),
    regularizations: buildDemoRegularizations(today),
    _nextLeaveId: 5,
    _nextRegId: 2,
  };
}
