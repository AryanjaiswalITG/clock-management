import { useState, useEffect, useCallback } from "react";
import { LogIn, LogOut, Clock, Coffee, Target, CheckCircle2, AlertCircle, RotateCcw, X } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import { formatDuration, formatHMS, formatClock, formatClockSec, formatHMSColon } from "../utils/time";

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
  const [summary, setSummary] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false); // reset confirmation modal
  const [resetting, setResetting] = useState(false);

  const load = useCallback(async () => {
    try {
      setSummary(await api.myAttendance());
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // 1s tick so the live clock and worked timer update.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  async function punch(action) {
    setBusy(true);
    setError(null);
    try {
      const next = action === "in" ? await api.clockIn() : await api.clockOut();
      setSummary(next);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  // Wipe today's sessions and restart the target timer from zero.
  async function doReset() {
    setResetting(true);
    setError(null);
    try {
      setSummary(await api.resetAttendance());
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
          <thead><tr><th>#</th><th>Clock In</th><th>Clock Out</th><th>Duration</th><th>Status</th></tr></thead>
          <tbody>
            {summary.sessions.length === 0 && (
              <tr><td colSpan={5} style={{ color: "var(--ink-soft)", textAlign: "center", padding: "24px" }}>No sessions yet — clock in to start your day.</td></tr>
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
                  <td><span className={`badge ${open ? "green" : "gray"}`}>{open ? "Active" : "Closed"}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

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
