import { useState, useEffect, useCallback } from "react";
import { LogIn, LogOut, Clock, Coffee, Target, CheckCircle2, AlertCircle, RotateCcw, X, CalendarRange, CalendarDays, Building2, Home, FileClock, PartyPopper } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import { useSettings } from "../settings/SettingsContext";
import { formatDuration, formatHMS, formatClock, formatClockSec, formatHMSColon, formatCutoff } from "../utils/time";
import MonthCalendar from "../components/MonthCalendar";
import MonthPicker from "../components/MonthPicker";
import DetailDrawer from "../components/DetailDrawer";
import Badge from "../components/Badge";
import Avatar from "../components/Avatar";
import { SUMMARY_ITEMS, styleFor } from "../components/attendanceStatus";
import { useAttendanceView } from "../attendance/AttendanceViewContext";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

// A short human note explaining a day's status (no logic — display only).
function statusNote(status, cutoff) {
  switch (status) {
    case "Present": return "Full day attended.";
    case "Half Day": return `First check-in was after the ${formatCutoff(cutoff)} cutoff — counted as a half day.`;
    case "Absent": return "No attendance was recorded for this working day.";
    case "Leave": return "On approved leave.";
    case "Weekend": return "Weekend — a non-working day.";
    case "Holiday": return "Company holiday — a non-working day.";
    case "Pending": return "Today — not clocked in yet.";
    case "Upcoming": return "A future working day.";
    case "Not employed": return "Outside your employment period (before your joining date).";
    default: return "";
  }
}

function DetailRow({ label, value }) {
  return (
    <div className="dd-row">
      <span className="dd-row-label">{label}</span>
      <span className="dd-row-value">{value}</span>
    </div>
  );
}

const TODAY = new Date();
const CUR_MONTH = { year: TODAY.getFullYear(), month: TODAY.getMonth() + 1 };
const pad2 = (n) => String(n).padStart(2, "0");
const TODAY_STR = `${TODAY.getFullYear()}-${pad2(TODAY.getMonth() + 1)}-${pad2(TODAY.getDate())}`;
// A past working day can be regularized (a forgotten/incorrect punch).
const REGULARIZABLE = ["Present", "Half Day", "Absent"];
const isoToHM = (iso) => (iso ? new Date(iso).toTimeString().slice(0, 5) : "");

// Mirror of the server's summarize() so the worked/away numbers tick live
// every second while clocked in (server stays the source of truth on each action).
function computeLive(sessions = [], targetSec = 28800, now = Date.now()) {
  const sorted = [...sessions].sort((a, b) => new Date(a.in) - new Date(b.in));
  let workedSec = 0;
  for (const s of sorted) {
    const start = new Date(s.in).getTime();
    const end = s.out ? new Date(s.out).getTime() : now;
    if (end > start) workedSec += Math.floor((end - start) / 1000);
  }
  let awaySec = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    const prevOut = sorted[i].out ? new Date(sorted[i].out).getTime() : null;
    const nextIn = new Date(sorted[i + 1].in).getTime();
    if (prevOut && nextIn > prevOut) awaySec += Math.floor((nextIn - prevOut) / 1000);
  }
  const clockedIn = sorted.some((s) => s.out === null);
  return {
    workedSec,
    awaySec,
    clockedIn,
    remainingSec: Math.max(0, targetSec - workedSec),
    overtimeSec: Math.max(0, workedSec - targetSec),
    targetMet: workedSec >= targetSec,
  };
}

function StatCard({ icon: Icon, label, value, sub, tone }) {
  return (
    <div className="card stat-card">
      <div className="row-between">
        <div className="stat-label"><Icon size={15} /> {label}</div>
        <div className="stat-icon" style={{ background: "var(--teal-soft)" }}><Icon size={17} color="var(--teal)" /></div>
      </div>
      <div className="stat-value" style={{ fontSize: 30 }}>{value}</div>
      {sub && <div className={`stat-delta ${tone || ""}`}>{sub}</div>}
    </div>
  );
}

export default function MyAttendance() {
  const { user } = useAuth();
  const { holidays } = useSettings();
  // view ("daily" | "monthly") + the header's monthly-summary popup are driven
  // from the shared AttendanceView context, controlled by the header switch.
  const { view, setMonthly: publishMonthly, setActive } = useAttendanceView();
  const [summary, setSummary] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false); // reset confirmation modal
  const [resetting, setResetting] = useState(false);
  const [month, setMonth] = useState(CUR_MONTH);
  const [monthly, setMonthly] = useState(null);
  // Detail-drawer selection: { kind:"day", day } | { kind:"status", item } | null
  const [selected, setSelected] = useState(null);
  const [depts, setDepts] = useState([]);
  // Where I'm working today — chosen before clocking in (office | remote).
  const [location, setLocation] = useState("office");
  // My own attendance-regularization requests + the request modal.
  const [regs, setRegs] = useState([]);
  const [regForm, setRegForm] = useState(null); // { date, in, out, reason } | null
  const [regBusy, setRegBusy] = useState(false);
  const [regError, setRegError] = useState(null);

  // Upcoming company holidays (today onward) for the holiday card.
  const upcomingHolidays = (holidays || []).filter((h) => h >= TODAY_STR).sort().slice(0, 6);

  // Department name for the "responsible person" block (read-only).
  useEffect(() => { api.departments().then(setDepts).catch(() => {}); }, []);
  const deptName = depts.find((d) => d.id === user?.deptId)?.name || "";

  // Tell the header to show the My Attendance / Monthly Attendance switch while
  // this page is mounted.
  useEffect(() => {
    setActive(true);
    return () => setActive(false);
  }, [setActive]);

  // Mirror the monthly summary up so the header's hover popup can show it.
  useEffect(() => { publishMonthly(monthly); }, [monthly, publishMonthly]);

  const load = useCallback(async () => {
    try {
      setSummary(await api.myAttendance());
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Load the monthly breakdown whenever the selected month changes (and after a punch).
  const loadMonthly = useCallback(async () => {
    try {
      setMonthly(await api.monthlyAttendance(month));
    } catch { /* keep previous month view on error */ }
  }, [month]);

  useEffect(() => { loadMonthly(); }, [loadMonthly]);

  // My regularization requests (own only, via the scoped endpoint).
  const loadRegs = useCallback(async () => {
    try { setRegs(await api.regularizations()); } catch { /* keep previous on error */ }
  }, []);
  useEffect(() => { loadRegs(); }, [loadRegs]);

  // 1s tick so the live clock and worked timer update.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  async function punch(action) {
    setBusy(true);
    setError(null);
    try {
      const next = action === "in" ? await api.clockIn(location) : await api.clockOut();
      setSummary(next);
      loadMonthly(); // today's status may have changed
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  // Open the regularization modal for a day, prefilling with any existing punches.
  function openReg(date) {
    const day = monthly?.days.find((d) => d.date === date);
    setRegError(null);
    setRegForm({
      date,
      in: isoToHM(day?.firstIn) || "09:00",
      out: isoToHM(day?.lastOut) || "18:00",
      reason: "",
    });
  }

  async function submitReg(e) {
    e.preventDefault();
    setRegError(null);
    if (!regForm.in || !regForm.out) { setRegError("Enter both a clock-in and clock-out time."); return; }
    const inIso = new Date(`${regForm.date}T${regForm.in}:00`).toISOString();
    const outIso = new Date(`${regForm.date}T${regForm.out}:00`).toISOString();
    if (new Date(outIso) <= new Date(inIso)) { setRegError("Clock-out must be after clock-in."); return; }
    setRegBusy(true);
    try {
      await api.applyRegularization({ date: regForm.date, in: inIso, out: outIso, reason: regForm.reason });
      setRegForm(null);
      setSelected(null);
      loadRegs();
    } catch (err) {
      setRegError(err.message);
    } finally {
      setRegBusy(false);
    }
  }

  // Is there already a pending request for this day?
  const pendingRegFor = (date) => regs.find((r) => r.date === date && r.status === "Pending");

  // Wipe today's sessions and restart the target timer from zero.
  async function doReset() {
    setResetting(true);
    setError(null);
    try {
      setSummary(await api.resetAttendance());
      loadMonthly();
    } catch (e) {
      setError(e.message);
    } finally {
      setResetting(false);
      setConfirmReset(false);
    }
  }

  if (!summary) {
    return <div style={{ color: "var(--ink-soft)" }}>{error || "Loading your day…"}</div>;
  }

  const targetSec = summary.targetSec;
  const live = computeLive(summary.sessions, targetSec, now);
  const pct = Math.min(100, Math.round((live.workedSec / targetSec) * 100));
  const nowDate = new Date(now);
  const fmtBig = nowDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <>
      {error && (
        <div className="card" style={{ marginBottom: 18, borderColor: "var(--rose)", color: "var(--rose)", display: "flex", alignItems: "center", gap: 8 }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* ===== Daily view (default) ===== */}
      {view === "daily" && (
      <div className="attn-view fade-in" key="daily">
      <div className="grid cols-2" style={{ marginBottom: 18 }}>
        {/* Live clock + punch button */}
        <div className="card panel-invert" style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center" }}>
          <div style={{ fontSize: 13, color: "var(--panel-ink-soft)", letterSpacing: ".1em", textTransform: "uppercase" }}>
            {nowDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 52, fontWeight: 600, margin: "6px 0 6px" }}>{fmtBig}</div>
          <div style={{ marginBottom: 18 }}>
            <span className={`badge ${live.clockedIn ? "green" : "gray"}`}>
              {live.clockedIn ? "● Clocked in" : "Clocked out"}
            </span>
          </div>

          {/* Where am I working today? Chosen before clocking in. Once clocked
              in the day's location is fixed, so we show it instead of the toggle. */}
          {!live.clockedIn ? (
            <div className="loc-toggle" role="group" aria-label="Work location" style={{ marginBottom: 16 }}>
              <button type="button" className={location === "office" ? "active" : ""} onClick={() => setLocation("office")}>
                <Building2 size={14} /> Office
              </button>
              <button type="button" className={location === "remote" ? "active" : ""} onClick={() => setLocation("remote")}>
                <Home size={14} /> Remote
              </button>
            </div>
          ) : (
            summary.sessions.some((s) => s.location) && (
              <div style={{ marginBottom: 16, fontSize: 13, color: "var(--panel-ink-soft)", display: "flex", alignItems: "center", gap: 6 }}>
                {summary.sessions[summary.sessions.length - 1]?.location === "remote"
                  ? <><Home size={14} /> Working remotely</>
                  : <><Building2 size={14} /> Working from office</>}
              </div>
            )
          )}

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
            {!live.clockedIn ? (
              <button className="btn primary" style={{ fontSize: 15, padding: "12px 28px" }} disabled={busy || resetting}
                onClick={() => punch("in")}>
                <LogIn size={17} style={{ marginRight: 8, verticalAlign: "-3px" }} /> {busy ? "…" : "Clock In"}
              </button>
            ) : (
              <button className="btn" style={{ fontSize: 15, padding: "12px 28px", background: "var(--amber)", color: "#fff" }} disabled={busy || resetting}
                onClick={() => punch("out")}>
                <LogOut size={17} style={{ marginRight: 8, verticalAlign: "-3px" }} /> {busy ? "…" : "Clock Out"}
              </button>
            )}
            {/* Reset clears today's sessions and restarts the target timer. */}
            <button
              className="btn"
              style={{
                fontSize: 15,
                padding: "12px 28px",
                background: "rgba(255,255,255,.08)",
                color: "var(--panel-ink)",
                border: "1px solid rgba(255,255,255,.22)",
              }}
              disabled={busy || resetting || summary.sessions.length === 0}
              onClick={() => setConfirmReset(true)}
              title={summary.sessions.length === 0 ? "Nothing to reset yet" : "Reset today's timer"}
            >
              <RotateCcw size={17} style={{ marginRight: 8, verticalAlign: "-3px" }} /> {resetting ? "…" : "Reset"}
            </button>
          </div>
          {summary.firstIn && (
            <div style={{ marginTop: 14, fontSize: 13, color: "var(--panel-ink-soft)" }}>
              First clock-in today at {formatClock(summary.firstIn)}
            </div>
          )}
        </div>

        {/* Target progress */}
        <div className="card">
          <div className="card-title">Today's Target</div>
          <div className="card-sub">{formatDuration(targetSec)} goal · {pct}% complete</div>

          <div style={{ height: 12, background: "var(--line)", borderRadius: 999, overflow: "hidden", margin: "8px 0 16px" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: live.targetMet ? "var(--green)" : "var(--teal)", transition: "width .4s" }} />
          </div>

          <div className="row-between" style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
            <span style={{ fontSize: 14, color: "var(--ink-soft)" }}>Worked so far</span>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{formatHMS(live.workedSec)}</span>
          </div>
          <div className="row-between" style={{ padding: "10px 0" }}>
            {live.targetMet ? (
              <>
                <span style={{ fontSize: 14, color: "var(--green)", display: "flex", alignItems: "center", gap: 6 }}><CheckCircle2 size={15} /> Overtime</span>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600, color: "var(--green)", fontVariantNumeric: "tabular-nums" }}>+{formatHMS(live.overtimeSec)}</span>
              </>
            ) : (
              <>
                <span style={{ fontSize: 14, color: "var(--ink-soft)" }}>Remaining to target</span>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600, color: "var(--amber)", fontVariantNumeric: "tabular-nums" }}>{formatHMS(live.remainingSec)}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid cols-4" style={{ marginBottom: 18 }}>
        <StatCard icon={Clock} label="Worked Today" value={formatHMS(live.workedSec)} sub={live.clockedIn ? "Counting live…" : "Paused"} tone={live.clockedIn ? "up" : ""} />
        <StatCard icon={Coffee} label="Away / Break" value={formatDuration(live.awaySec)} sub="Time between sessions" />
        <StatCard icon={Target} label="Target" value={formatDuration(targetSec)} sub={`${pct}% done`} tone={live.targetMet ? "up" : "down"} />
        <StatCard icon={CheckCircle2} label="Status" value={live.clockedIn ? "Working" : (summary.sessions.length ? "Done" : "Not started")} sub={`${summary.sessions.length} session${summary.sessions.length === 1 ? "" : "s"}`} />
      </div>

      {/* Sessions today */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: "18px 20px 6px" }}>
          <div className="card-title">Today's Sessions</div>
          <div className="card-sub">Every clock-in and clock-out, {user?.name}</div>
        </div>
        <table>
          <thead><tr><th>#</th><th>Clock In</th><th>Clock Out</th><th>Duration</th><th>Where</th><th>Status</th></tr></thead>
          <tbody>
            {summary.sessions.length === 0 && (
              <tr><td colSpan={6} style={{ color: "var(--ink-soft)", textAlign: "center", padding: "24px" }}>No sessions yet — clock in to start your day.</td></tr>
            )}
            {summary.sessions.map((s, i) => {
              const open = s.out === null;
              // Duration = real elapsed time between clock-in and clock-out.
              // While a session is still open it ticks against the live clock.
              const startMs = new Date(s.in).getTime();
              const endMs = open ? now : new Date(s.out).getTime();
              const dur = Math.max(0, (endMs - startMs) / 1000);
              return (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{formatClockSec(s.in)}</td>
                  <td>{open ? "—" : formatClockSec(s.out)}</td>
                  <td style={{ fontVariantNumeric: "tabular-nums" }} title={`${Math.floor(dur)} seconds`}>{formatHMSColon(dur)}</td>
                  <td><span className={`badge ${s.location === "remote" ? "violet" : "teal"}`}>{s.location === "remote" ? "Remote" : "Office"}</span></td>
                  <td><span className={`badge ${open ? "green" : "gray"}`}>{open ? "Active" : "Closed"}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Upcoming company holidays — so you can plan around non-working days. */}
      <div className="card" style={{ marginTop: 18 }}>
        <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}><PartyPopper size={17} /> Upcoming Holidays</div>
        <div className="card-sub">Company holidays coming up — non-working days</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
          {upcomingHolidays.length === 0 && <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>No upcoming holidays configured.</span>}
          {upcomingHolidays.map((d) => (
            <span key={d} className="badge teal">
              {new Date(`${d}T00:00:00`).toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" })}
            </span>
          ))}
        </div>
      </div>
      </div>
      )}

      {/* ===== Monthly view ===== */}
      {view === "monthly" && (
      <div className="attn-view fade-in" key="monthly">
      {/* ---- Monthly overview ---- */}
      <div className="card">
        <div className="row-between" style={{ marginBottom: 4 }}>
          <div>
            <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}><CalendarRange size={17} /> Monthly Attendance</div>
            <div className="card-sub">Present, absent, leave, half-day, weekends & holidays</div>
          </div>
          <MonthPicker value={month} onChange={setMonth} max={CUR_MONTH} />
        </div>

        {!monthly ? (
          <div style={{ color: "var(--ink-soft)", padding: "16px 0" }}>Loading month…</div>
        ) : (
          <>
            <div className="status-chips" style={{ margin: "14px 0 6px" }}>
              {SUMMARY_ITEMS.map(({ key, status }) => {
                const st = styleFor(status);
                return (
                  <button key={key} type="button" className="status-chip clickable"
                    onClick={() => setSelected({ kind: "status", item: { key, status } })}>
                    <div className="n" style={{ color: st.color }}>{monthly.totals[key]}</div>
                    <div className="l"><span className="month-cal-dot" style={{ position: "static", background: st.color }} /> {st.label}</div>
                  </button>
                );
              })}
            </div>

            <div style={{ marginTop: 16 }}>
              <MonthCalendar
                days={monthly.days}
                onSelect={(day) => setSelected({ kind: "day", day })}
                selectedDate={selected?.kind === "day" ? selected.day.date : null}
              />
            </div>

            <div className="status-legend">
              {SUMMARY_ITEMS.map(({ key, status }) => {
                const st = styleFor(status);
                return (
                  <div key={key} className="item">
                    <span className="swatch" style={{ background: st.color }} /> {st.label}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ---- Weekend report ---- */}
      {monthly && (
        <div className="card" style={{ marginTop: 18 }}>
          <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}><CalendarDays size={17} /> Weekend Report</div>
          <div className="card-sub">{monthly.weekends.length} weekend day{monthly.weekends.length === 1 ? "" : "s"} this month</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
            {monthly.weekends.length === 0 && <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>No weekends configured.</span>}
            {monthly.weekends.map((d) => (
              <span key={d} className="badge gray">
                {new Date(`${d}T00:00:00`).toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" })}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ---- My regularization requests ---- */}
      {regs.length > 0 && (
        <div className="card" style={{ marginTop: 18, padding: 0 }}>
          <div style={{ padding: "18px 20px 6px" }}>
            <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}><FileClock size={17} /> My Regularization Requests</div>
            <div className="card-sub">Attendance corrections you've requested</div>
          </div>
          <table>
            <thead><tr><th>Day</th><th>Requested in / out</th><th>Reason</th><th>Status</th></tr></thead>
            <tbody>
              {[...regs].sort((a, b) => b.date.localeCompare(a.date)).map((r) => (
                <tr key={r.id}>
                  <td>{new Date(`${r.date}T00:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</td>
                  <td style={{ fontVariantNumeric: "tabular-nums" }}>{formatClock(r.in)} → {formatClock(r.out)}</td>
                  <td style={{ color: "var(--ink-soft)" }}>{r.reason || "—"}</td>
                  <td><Badge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </div>
      )}

      {/* ===== Detail drawer — day / status details (single reused panel) ===== */}
      <DetailDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.kind === "day" ? "Attendance details" : selected?.kind === "status" ? `${styleFor(selected.item.status).label} — summary` : ""}
        subtitle={monthly ? `${MONTH_NAMES[monthly.month - 1]} ${monthly.year}` : ""}
      >
        {selected && (
          <>
            {/* Responsible person */}
            <div className="dd-person">
              <Avatar src={user.avatarUrl} initials={user.avatar} className="emp-avatar" style={{ width: 44, height: 44, fontSize: 15 }} />
              <div style={{ minWidth: 0 }}>
                <div className="dd-person-name">{user.name}</div>
                <div className="dd-person-sub">{user.designation}{deptName ? ` · ${deptName}` : ""}</div>
              </div>
              <span className="dd-person-tag">Responsible</span>
            </div>

            {selected.kind === "day" && (() => {
              const day = selected.day;
              const dl = new Date(`${day.date}T00:00:00`);
              return (
                <>
                  <div className="dd-status-row">
                    <span className="dd-date">{dl.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</span>
                    <Badge status={day.status} />
                  </div>
                  <div className="dd-rows">
                    <DetailRow label="Status" value={day.status} />
                    <DetailRow label="First clock-in" value={formatClock(day.firstIn)} />
                    <DetailRow label="Last clock-out" value={formatClock(day.lastOut)} />
                    <DetailRow label="Worked hours" value={day.workedSec ? formatDuration(day.workedSec) : "—"} />
                    <DetailRow label="Daily target" value={`${user.targetHours} h`} />
                    <DetailRow label="Half-day cutoff" value={formatCutoff(user.halfDayCutoff)} />
                    <DetailRow label="Employee ID" value={`#${String(user.id).padStart(4, "0")}`} />
                  </div>
                  <div className="dd-note">{statusNote(day.status, user.halfDayCutoff)}</div>
                  {/* Regularization: fix a past working day's punches (manager approves). */}
                  {day.date < TODAY_STR && REGULARIZABLE.includes(day.status) && (
                    pendingRegFor(day.date)
                      ? <div className="dd-note" style={{ color: "var(--amber)" }}>A regularization request for this day is pending approval.</div>
                      : <button className="btn ghost" style={{ marginTop: 14, width: "100%", justifyContent: "center" }} onClick={() => openReg(day.date)}>
                          <FileClock size={15} style={{ marginRight: 8, verticalAlign: "-3px" }} /> Request regularization
                        </button>
                  )}
                </>
              );
            })()}

            {selected.kind === "status" && (() => {
              const { status } = selected.item;
              const dates = (monthly?.days || []).filter((d) => d.status === status);
              return (
                <>
                  <div className="dd-status-row">
                    <span className="dd-date">{styleFor(status).label}</span>
                    <Badge status={status} />
                  </div>
                  <div className="dd-rows">
                    <DetailRow label="Days this month" value={dates.length} />
                    <DetailRow label="Daily target" value={`${user.targetHours} h`} />
                  </div>
                  <div className="dd-subhead">Dates</div>
                  <div className="dd-date-list">
                    {dates.length === 0 && <span className="dd-empty">No days with this status.</span>}
                    {dates.map((d) => (
                      <span key={d.date} className="badge gray">
                        {new Date(`${d.date}T00:00:00`).toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" })}
                      </span>
                    ))}
                  </div>
                  <div className="dd-note">{statusNote(status, user.halfDayCutoff)}</div>
                </>
              );
            })()}
          </>
        )}
      </DetailDrawer>

      {/* Regularization request modal */}
      {regForm && (
        <div className="modal-overlay" onClick={() => !regBusy && setRegForm(null)}>
          <form className="modal modal-form" onClick={(e) => e.stopPropagation()} onSubmit={submitReg}>
            <button type="button" className="modal-close" onClick={() => setRegForm(null)} disabled={regBusy} aria-label="Close"><X size={18} /></button>
            <div className="modal-title" style={{ textAlign: "left" }}>Request regularization</div>
            <div className="modal-message" style={{ textAlign: "left", margin: "6px 0 16px" }}>
              Correct your attendance for {new Date(`${regForm.date}T00:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}. Your manager reviews and approves it.
            </div>
            {regError && <div className="form-error">{regError}</div>}
            <div className="field-row">
              <div className="field">
                <label className="field-label">Clock in</label>
                <input type="time" className="field-control" value={regForm.in} onChange={(e) => setRegForm({ ...regForm, in: e.target.value })} required />
              </div>
              <div className="field">
                <label className="field-label">Clock out</label>
                <input type="time" className="field-control" value={regForm.out} onChange={(e) => setRegForm({ ...regForm, out: e.target.value })} required />
              </div>
            </div>
            <div className="field">
              <label className="field-label">Reason</label>
              <input className="field-control" value={regForm.reason} placeholder="e.g. Forgot to clock out" onChange={(e) => setRegForm({ ...regForm, reason: e.target.value })} />
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
              <button type="button" className="btn ghost" onClick={() => setRegForm(null)} disabled={regBusy}>Cancel</button>
              <button type="submit" className="btn primary" disabled={regBusy}>{regBusy ? "Submitting…" : "Submit request"}</button>
            </div>
          </form>
        </div>
      )}

      {/* Reset confirmation — guards against accidental clicks. */}
      {confirmReset && (
        <div className="modal-overlay" onClick={() => !resetting && setConfirmReset(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setConfirmReset(false)} disabled={resetting} aria-label="Close"><X size={18} /></button>
            <div className="modal-icon"><RotateCcw size={26} color="var(--rose)" /></div>
            <div className="modal-title">Reset today's timer?</div>
            <div className="modal-message">
              This clears all of today's sessions and restarts your target timer from {formatDuration(targetSec)}.
              This can't be undone.
            </div>
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setConfirmReset(false)} disabled={resetting}>Cancel</button>
              <button className="btn primary" onClick={doReset} disabled={resetting} autoFocus>
                {resetting ? "Resetting…" : "Reset"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
