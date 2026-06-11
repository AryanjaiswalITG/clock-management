// Demo seed data shared by the browser mock (src/mockApi.js) and the Express
// JSON store (server/db.js). Profiles only — each backend attaches its own
// password representation (mock: plaintext; server: bcrypt hash).
//
// Bump SEED_VERSION when this data changes to re-seed existing browsers.
export const SEED_VERSION = 2;

export const DEMO_DEPARTMENTS = [
  { id: 1, name: "Engineering" },
  { id: 2, name: "Product" },
  { id: 3, name: "People & HR" },
  { id: 4, name: "Sales" },
  { id: 5, name: "Finance" },
];

// Every demo account uses the password "password123".
// halfDayCutoff "13:00"/"13:30" enables the auto Half-Day rule for some people.
export const DEMO_EMPLOYEES = [
  { id: 1, name: "Aryan Jaiswal", designation: "Developer", deptId: 1, managerId: 2, email: "aryanjaiswal@demo.do", joinDate: "2024-01-15", status: "Active", avatar: "AJ", avatarUrl: null, role: "employee", targetHours: 8, halfDayCutoff: "13:00" },
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

// A couple of leave requests in the current month: one Approved (shows as
// "Leave" on the calendar) and one Pending (shows in admin approvals).
export function buildDemoLeaves(today = new Date()) {
  const y = today.getFullYear();
  const mo = today.getMonth();
  return [
    { id: 1, employeeId: 4, type: "Casual", from: dstr(y, mo, 2), to: dstr(y, mo, 3), days: 2, status: "Approved", reason: "Family function" },
    { id: 2, employeeId: 3, type: "Sick", from: dstr(y, mo, Math.min(28, today.getDate() + 2)), to: dstr(y, mo, Math.min(28, today.getDate() + 2)), days: 1, status: "Pending", reason: "Doctor visit" },
  ];
}

// Full demo dataset (profiles + attendance + leaves), minus passwords.
export function buildDemoData(today = new Date()) {
  return {
    departments: DEMO_DEPARTMENTS,
    employees: DEMO_EMPLOYEES,
    attendance: buildDemoAttendance(today),
    leaves: buildDemoLeaves(today),
    _nextLeaveId: 3,
  };
}
