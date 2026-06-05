// Pure helpers to turn a day's punch sessions into a work summary.
// A "session" = { in: ISO, out: ISO|null }. out=null means currently clocked in.

import { dateKey } from "./db.js";

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

// Compute worked / away / target numbers (all in seconds) from sessions.
export function summarize(sessions, targetHours = 8, now = new Date()) {
  const sorted = [...sessions].sort((a, b) => new Date(a.in) - new Date(b.in));
  let workedSec = 0;
  for (const s of sorted) {
    const start = new Date(s.in).getTime();
    const end = (s.out ? new Date(s.out) : now).getTime();
    if (end > start) workedSec += Math.floor((end - start) / 1000);
  }

  // Away = gaps BETWEEN sessions (breaks during the day). Time after the final
  // clock-out is "gone home", not counted as away.
  let awaySec = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    const prevOut = sorted[i].out ? new Date(sorted[i].out).getTime() : null;
    const nextIn = new Date(sorted[i + 1].in).getTime();
    if (prevOut && nextIn > prevOut) awaySec += Math.floor((nextIn - prevOut) / 1000);
  }

  const targetSec = Math.round(targetHours * 3600);
  const clockedIn = sorted.some((s) => s.out === null);
  const firstIn = sorted.length ? sorted[0].in : null;
  const lastOut = clockedIn ? null : (sorted.length ? sorted[sorted.length - 1].out : null);

  let status = "Not started";
  if (clockedIn) status = "Working";
  else if (sorted.length) status = "Clocked out";

  return {
    status,
    clockedIn,
    workedSec,
    awaySec,
    targetSec,
    remainingSec: Math.max(0, targetSec - workedSec),
    overtimeSec: Math.max(0, workedSec - targetSec),
    targetMet: workedSec >= targetSec,
    firstIn,
    lastOut,
    sessions: sorted,
  };
}
