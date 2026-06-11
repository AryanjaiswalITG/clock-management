// Attendance helpers. The pure work-summary math lives in shared/attendance.js
// (so the browser mock computes identical numbers); this file adds the
// db-aware lookups the Express routes use.

import { dateKey, summarize } from "../shared/attendance.js";

export { summarize };

// Find (or lazily create) today's attendance record for an employee.
export function todayRecord(db, employeeId, { create = false } = {}) {
  const today = dateKey();
  let rec = db.attendance.find((a) => a.employeeId === employeeId && a.date === today);
  if (!rec && create) {
    rec = { employeeId, date: today, sessions: [] };
    db.attendance.push(rec);
  }
  return rec;
}

// Is the employee currently clocked in (an open session exists)?
export function isClockedIn(rec) {
  return !!rec && rec.sessions.some((s) => s.out === null);
}
