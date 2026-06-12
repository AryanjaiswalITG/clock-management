// Shared, pure leave-policy logic — imported by BOTH the Express server and the
// in-browser mock so balances and validation match everywhere. No I/O.

// Leave types the app supports. "Work From Home" has no annual cap (unlimited).
export const LEAVE_TYPES = ["Casual", "Sick", "Annual", "Work From Home"];

// Annual entitlement per type (days). 0 / null = unlimited (e.g. WFH).
export const ENTITLEMENTS = {
  Casual: 12,
  Sick: 12,
  Annual: 24,
  "Work From Home": 0,
};

export const isUnlimited = (type) => !ENTITLEMENTS[type];

// Inclusive whole-day count between two "YYYY-MM-DD" dates (min 1).
export function leaveDays(from, to) {
  if (!from || !to) return 0;
  const a = new Date(`${from}T00:00:00`).getTime();
  const b = new Date(`${to}T00:00:00`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 0;
  return Math.round((b - a) / 86400000) + 1;
}

// Two inclusive date ranges overlap?
const rangesOverlap = (aFrom, aTo, bFrom, bTo) => aFrom <= bTo && bFrom <= aTo;

// Days of a given type already committed for an employee. "Approved" always
// counts; "Pending" counts too when includePending (so you can't double-book a
// balance while requests await a decision).
export function usedDays(leaves, employeeId, type, { includePending = true } = {}) {
  return leaves
    .filter((l) => l.employeeId === employeeId && l.type === type &&
      (l.status === "Approved" || (includePending && l.status === "Pending")))
    .reduce((sum, l) => sum + (l.days || leaveDays(l.from, l.to)), 0);
}

// Full balance breakdown for one employee, one row per leave type.
export function balancesFor(leaves, employeeId) {
  return LEAVE_TYPES.map((type) => {
    const entitlement = ENTITLEMENTS[type] || 0;
    const approved = usedDays(leaves, employeeId, type, { includePending: false });
    const committed = usedDays(leaves, employeeId, type, { includePending: true });
    const pending = committed - approved;
    const unlimited = isUnlimited(type);
    return {
      type,
      entitlement,
      unlimited,
      approved,
      pending,
      used: committed,
      remaining: unlimited ? Infinity : Math.max(0, entitlement - committed),
    };
  });
}

// Validate a new request against dates, overlaps and remaining balance.
// Returns { ok: true, days } or { ok: false, error }. Pure — callers decide
// how to surface the error (HTTP 400 on the server, inline message in the UI).
export function validateLeaveRequest(leaves, employeeId, { type, from, to } = {}) {
  if (!type || !LEAVE_TYPES.includes(type)) return { ok: false, error: "Pick a valid leave type." };
  if (!from || !to) return { ok: false, error: "Both a start and end date are required." };
  if (to < from) return { ok: false, error: "End date can't be before the start date." };

  const days = leaveDays(from, to);
  if (days < 1) return { ok: false, error: "That date range isn't valid." };

  // No overlap with an existing pending/approved request.
  const clash = leaves.some(
    (l) => l.employeeId === employeeId && l.status !== "Rejected" &&
      rangesOverlap(from, to, l.from, l.to)
  );
  if (clash) return { ok: false, error: "You already have a leave request covering those dates." };

  // Balance check (unlimited types skip this).
  if (!isUnlimited(type)) {
    const remaining = ENTITLEMENTS[type] - usedDays(leaves, employeeId, type, { includePending: true });
    if (days > remaining) {
      return { ok: false, error: `Not enough ${type} balance — ${Math.max(0, remaining)} day(s) left, you requested ${days}.` };
    }
  }
  return { ok: true, days };
}
