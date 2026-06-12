// Pending attendance-regularization requests the signed-in approver can act on.
// Shared by the admin Attendance page and the manager Team page. Self-contained:
// reads everything it needs from DataContext + AuthContext.
import { useData } from "../data/DataContext";
import { useAuth } from "../auth/AuthContext";
import { formatClock } from "../utils/time";
import Badge from "../components/Badge";

const fmtDate = (d) => new Date(`${d}T00:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

export default function RegularizationApprovals() {
  const { user } = useAuth();
  const { regularizations, setRegularizationStatus, empName, empAvatar } = useData();

  // Anyone else's pending requests are actionable by an approver.
  const pending = (regularizations || []).filter((r) => r.status === "Pending" && r.employeeId !== user.id);

  return (
    <div className="card" style={{ padding: 0, marginBottom: 18 }}>
      <div style={{ padding: "18px 20px 6px" }}>
        <div className="card-title">Attendance Regularizations</div>
        <div className="card-sub">Corrections waiting on your approval</div>
      </div>
      <table>
        <thead><tr><th>Employee</th><th>Day</th><th>Requested in / out</th><th>Reason</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {pending.length === 0 && (
            <tr><td colSpan={6} style={{ color: "var(--ink-soft)", textAlign: "center", padding: 20 }}>No pending regularizations 🎉</td></tr>
          )}
          {pending.map((r) => (
            <tr key={r.id}>
              <td><div className="emp-cell"><div className="emp-avatar">{empAvatar(r.employeeId)}</div><span className="emp-name">{empName(r.employeeId)}</span></div></td>
              <td>{fmtDate(r.date)}</td>
              <td style={{ fontVariantNumeric: "tabular-nums" }}>{formatClock(r.in)} → {formatClock(r.out)}</td>
              <td style={{ color: "var(--ink-soft)" }}>{r.reason || "—"}</td>
              <td><Badge status={r.status} /></td>
              <td style={{ textAlign: "right" }}>
                <button className="btn primary sm" style={{ marginRight: 6 }} onClick={() => setRegularizationStatus(r.id, "Approved")}>Approve</button>
                <button className="btn ghost sm" onClick={() => setRegularizationStatus(r.id, "Rejected")}>Decline</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
