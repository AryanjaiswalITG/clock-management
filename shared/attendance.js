// Shared, pure attendance logic — imported by BOTH the Express server
// (server/*) and the in-browser mock (src/mockApi.js) so the two backends
// always compute the same numbers. No I/O, no framework imports.

// "YYYY-MM-DD" for a Date in local time.
export function dateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Turn a day's punch sessions into a work summary (all values in seconds).
// A "session" = { in: ISO, out: ISO|null }. out=null means currently clocked in.
export function summarize(sessions, targetHours = 8, now = new Date()) {
  const sorted = [...sessions].sort((a, b) => new Date(a.in) - new Date(b.in));
  let workedSec = 0;
  for (const s of sorted) {
    const start = new Date(s.in).getTime();
    const end = (s.out ? new Date(s.out) : now).getTime();
    if (end > start) workedSec += Math.floor((end - start) / 1000);
  }
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
    status, clockedIn, workedSec, awaySec, targetSec,
    remainingSec: Math.max(0, targetSec - workedSec),
    overtimeSec: Math.max(0, workedSec - targetSec),
    targetMet: workedSec >= targetSec,
    firstIn, lastOut, sessions: sorted,
  };
}

// ---- Monthly attendance status --------------------------------------------

// The canonical daily statuses. Imported by the UI for labels/colours too.
export const STATUS = {
  PRESENT: "Present",
  HALF: "Half Day",
  ABSENT: "Absent",
  LEAVE: "Leave",
  WEEKEND: "Weekend",
  HOLIDAY: "Holiday",
  UPCOMING: "Upcoming", // a future date this month
  PENDING: "Pending",   // today, no check-in yet (day not over)
  OUTSIDE: "Not employed", // date is outside the employee's lifecycle (before join / after exit)
};

// Default weekend = Saturday (6) + Sunday (0). getDay(): 0=Sun … 6=Sat.
export const DEFAULT_WEEKEND_DAYS = [0, 6];

export function isWeekend(dateStr, weekendDays = DEFAULT_WEEKEND_DAYS) {
  const dow = new Date(`${dateStr}T00:00:00`).getDay();
  return weekendDays.includes(dow);
}

export function isHoliday(dateStr, holidays = []) {
  return holidays.includes(dateStr);
}

// "13:00" -> 780 (minutes since midnight); null/invalid -> null.
export function cutoffToMinutes(cutoff) {
  if (!cutoff) return null;
  const [h, m] = String(cutoff).split(":").map(Number);
  if (!Number.isFinite(h)) return null;
  return h * 60 + (Number.isFinite(m) ? m : 0);
}

// Minutes-since-local-midnight of the first clock-in, or null if none.
export function firstInMinutes(sessions = []) {
  if (!sessions.length) return null;
  const sorted = [...sessions].sort((a, b) => new Date(a.in) - new Date(b.in));
  const d = new Date(sorted[0].in);
  return d.getHours() * 60 + d.getMinutes();
}

// Is an APPROVED leave covering this date for this employee?
export function leaveCovers(leaves = [], employeeId, dateStr) {
  return leaves.some(
    (l) => l.employeeId === employeeId && l.status === "Approved" &&
      dateStr >= l.from && dateStr <= l.to
  );
}

// Decide the status for one employee on one calendar day.
// Lifecycle first: dates before the account's creation (joinDate) or after its
// deletion (endDate) are "Not employed" and are never counted. Then weekends
// and holidays are calendar facts. For a working day: past with punches ->
// Present/Half Day, past without -> Absent, today without -> Pending,
// future -> Upcoming.
// Rule 1 (Half Day): a cutoff is configured AND the first check-in is AFTER it.
// Rule 2 (Absent):  no check-in at all on a past working day (and not on leave).
export function dayStatus({
  date,
  sessions = [],
  halfDayCutoff = null,
  onLeave = false,
  weekendDays = DEFAULT_WEEKEND_DAYS,
  holidays = [],
  today = dateKey(),
  joinDate = null,   // "YYYY-MM-DD" account creation date
  endDate = null,    // "YYYY-MM-DD" deletion date (inclusive), null = still active
}) {
  // Outside the employment lifecycle — not attendance, never counted.
  if (joinDate && date < joinDate) return STATUS.OUTSIDE;
  if (endDate && date > endDate) return STATUS.OUTSIDE;
  // Calendar facts — true regardless of whether the day is past or future.
  if (isWeekend(date, weekendDays)) return STATUS.WEEKEND;
  if (isHoliday(date, holidays)) return STATUS.HOLIDAY;
  if (onLeave) return STATUS.LEAVE;
  if (sessions.length) {
    const cm = cutoffToMinutes(halfDayCutoff);
    const fim = firstInMinutes(sessions);
    if (cm != null && fim != null && fim > cm) return STATUS.HALF;
    return STATUS.PRESENT;
  }
  if (date > today) return STATUS.UPCOMING; // a future working day, no punches yet
  return date === today ? STATUS.PENDING : STATUS.ABSENT;
}

// All "YYYY-MM-DD" dates in a month. monthIndex is 0-11.
export function monthDates(year, monthIndex) {
  const last = new Date(year, monthIndex + 1, 0).getDate();
  const out = [];
  for (let d = 1; d <= last; d++) {
    out.push(`${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  return out;
}

const emptyTotals = () => ({
  present: 0, halfDay: 0, absent: 0, leave: 0,
  weekend: 0, holiday: 0, upcoming: 0, pending: 0, workingDays: 0,
});

function tallyStatus(totals, status) {
  if (status === STATUS.PRESENT) totals.present++;
  else if (status === STATUS.HALF) totals.halfDay++;
  else if (status === STATUS.ABSENT) totals.absent++;
  else if (status === STATUS.LEAVE) totals.leave++;
  else if (status === STATUS.WEEKEND) totals.weekend++;
  else if (status === STATUS.HOLIDAY) totals.holiday++;
  else if (status === STATUS.UPCOMING) totals.upcoming++;
  else if (status === STATUS.PENDING) totals.pending++;
  // Working days = the days an employee is expected to attend (within lifecycle).
  if (status !== STATUS.WEEKEND && status !== STATUS.HOLIDAY &&
      status !== STATUS.UPCOMING && status !== STATUS.OUTSIDE) {
    totals.workingDays++;
  }
}

// Full per-day breakdown + totals for ONE employee over a month (1-12).
// joinDate (from the employee) and endDate (deletion date for former employees)
// bound the lifecycle; dates outside it are "Not employed" and not counted.
export function monthlyForEmployee({ year, month, employee, records = [], leaves = [], settings = {}, today = dateKey(), endDate = null }) {
  const monthIndex = month - 1;
  const weekendDays = settings.weekendDays ?? DEFAULT_WEEKEND_DAYS;
  const holidays = settings.holidays ?? [];
  const joinDate = employee.joinDate || null;
  const byDate = {};
  for (const r of records) if (r.employeeId === employee.id) byDate[r.date] = r;

  const totals = emptyTotals();
  const days = monthDates(year, monthIndex).map((date) => {
    const sessions = byDate[date]?.sessions || [];
    const onLeave = leaveCovers(leaves, employee.id, date);
    const status = dayStatus({ date, sessions, halfDayCutoff: employee.halfDayCutoff, onLeave, weekendDays, holidays, today, joinDate, endDate });
    tallyStatus(totals, status);
    const s = summarize(sessions, employee.targetHours);
    return {
      date,
      weekday: new Date(`${date}T00:00:00`).getDay(),
      status,
      firstIn: s.firstIn,
      lastOut: s.lastOut,
      workedSec: s.workedSec,
    };
  });

  const weekends = days.filter((d) => d.status === STATUS.WEEKEND).map((d) => d.date);
  return { year, month, employeeId: employee.id, days, totals, weekends, weekendDays, holidays };
}

// Totals per employee for the whole team over a month + the shared weekend list.
export function monthlyForTeam({ year, month, employees = [], records = [], leaves = [], settings = {}, today = dateKey() }) {
  const monthIndex = month - 1;
  const weekendDays = settings.weekendDays ?? DEFAULT_WEEKEND_DAYS;
  const holidays = settings.holidays ?? [];
  const dates = monthDates(year, monthIndex);
  const weekends = dates.filter((d) => isWeekend(d, weekendDays));
  // Each emp may carry endDate (former employees) + deleted flag for audit rows.
  const rows = employees.map((emp) => {
    const { totals } = monthlyForEmployee({ year, month, employee: emp, records, leaves, settings, today, endDate: emp.endDate || null });
    return { employeeId: emp.id, name: emp.name, deleted: !!emp.deleted, totals };
  });
  return { year, month, weekendDays, holidays, weekends, holidayDates: holidays.filter((h) => dates.includes(h)), rows };
}
