// Formatting helpers shared across pages.

// 32940 -> "9h 09m"
export function formatDuration(totalSec) {
  const s = Math.max(0, Math.floor(totalSec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

// 33023 -> "9h 10m 23s"  (includes live seconds — used for the ticking timer)
export function formatHMS(totalSec) {
  const t = Math.max(0, Math.floor(totalSec || 0));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const pad = (n) => String(n).padStart(2, "0");
  if (h > 0) return `${h}h ${pad(m)}m ${pad(s)}s`;
  if (m > 0) return `${m}m ${pad(s)}s`;
  return `${s}s`;
}

// ISO timestamp -> "09:31 AM" (empty dash if null)
export function formatClock(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ISO timestamp -> "09:31:05 AM" — includes seconds so short sessions are
// distinguishable (a clock-in and clock-out seconds apart no longer look identical).
export function formatClockSec(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// "13:00" -> "1:00 PM"  (empty dash if not set)
export function formatCutoff(hhmm) {
  if (!hhmm) return "—";
  const [h, m] = String(hhmm).split(":").map(Number);
  if (!Number.isFinite(h)) return "—";
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m || 0).padStart(2, "0")} ${ampm}`;
}

// Elapsed seconds -> strict "HH:MM:SS" (e.g. 30600 -> "08:30:00").
// Always derived from a real duration; clamped to >= 0, hours are not capped at 24.
export function formatHMSColon(totalSec) {
  const t = Math.max(0, Math.floor(totalSec || 0));
  const pad = (n) => String(n).padStart(2, "0");
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
