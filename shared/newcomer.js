// "Newly" badge window, shared by the browser mock, the Express server and the
// React UI so the rule lives in one place.
//
// A freshly created account is flagged "Newly" for the first NEW_BADGE_DAYS
// days after its creation timestamp, then the flag clears automatically. The
// flag is COMPUTED from createdAt every time it's read — it's never stored as a
// status, so it "expires" without any cron job or manual cleanup.

export const NEW_BADGE_DAYS = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

// The ISO timestamp an account was created. Falls back to joinDate (date-only)
// for older records created before the createdAt field existed, so the badge
// still behaves sensibly for pre-existing users (backward compatibility).
export function createdAtOf(employee) {
  if (!employee) return null;
  if (employee.createdAt) return employee.createdAt;
  if (employee.joinDate) return `${employee.joinDate}T00:00:00.000Z`;
  return null;
}

// True while the account is still within its first NEW_BADGE_DAYS days.
// `now` is injectable for testing.
export function isNewcomer(employee, now = new Date()) {
  const created = createdAtOf(employee);
  if (!created) return false;
  const ageMs = now.getTime() - new Date(created).getTime();
  return ageMs >= 0 && ageMs < NEW_BADGE_DAYS * DAY_MS;
}
