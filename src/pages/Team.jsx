import { Users, UserCheck, Plane, ClipboardCheck } from "lucide-react";
import { useData } from "../data/DataContext";
import { useAuth } from "../auth/AuthContext";
import { formatClock, formatDuration } from "../utils/time";
import Badge from "../components/Badge";
import RegularizationApprovals from "../components/RegularizationApprovals";

function Stat({ icon: Icon, label, value, sub, tone }) {
  return (
    <div className="card">
      <div className="row-between">
        <div className="stat-label"><Icon size={15} /> {label}</div>
        <div className="stat-icon" style={{ background: "var(--teal-soft)" }}><Icon size={17} color="var(--teal)" /></div>
      </div>
      <div className="stat-value">{value}</div>
      {sub && <div className={`stat-delta ${tone || ""}`}>{sub}</div>}
    </div>
  );
}

export default function Team() {
  const { user } = useAuth();
  const { employees, attendanceToday, leaves, regularizations, deptName, loading } = useData();

  if (loading) return <div style={{ color: "var(--ink-soft)" }}>Loading your team…</div>;

  // employees from the API already = self + direct reports; drop self for the team view.
  const reports = employees.filter((e) => e.id !== user.id);
  const reportIds = new Set(reports.map((e) => e.id));
  const todayById = new Map(attendanceToday.map((a) => [a.employeeId, a]));

  const presentToday = reports.filter((e) => {
    const s = todayById.get(e.id)?.status;
    return s === "Present" || s === "Working";
  }).length;
  const pendingLeaves = leaves.filter((l) => l.status === "Pending" && reportIds.has(l.employeeId));
  const pendingRegs = (regularizations || []).filter((r) => r.status === "Pending" && reportIds.has(r.employeeId));

  return (
    <>
      <div className="grid cols-4" style={{ marginBottom: 18 }}>
        <Stat icon={Users} label="My Reports" value={reports.length} sub="Direct reports" tone="up" />
        <Stat icon={UserCheck} label="Present Today" value={presentToday} sub={`${reports.length ? Math.round(presentToday / reports.length * 100) : 0}% of team`} tone="up" />
        <Stat icon={Plane} label="Pending Leaves" value={pendingLeaves.length} sub="Awaiting admin" tone={pendingLeaves.length ? "down" : ""} />
        <Stat icon={ClipboardCheck} label="Regularizations" value={pendingRegs.length} sub="Awaiting you" tone={pendingRegs.length ? "down" : ""} />
      </div>

      {/* Reports + today's status */}
      <div className="card" style={{ padding: 0, marginBottom: 18 }}>
        <div style={{ padding: "18px 20px 6px" }}>
          <div className="card-title">My Team — Today</div>
          <div className="card-sub">Live attendance for your direct reports</div>
        </div>
        <table>
          <thead><tr><th>Employee</th><th>Department</th><th>Clock In</th><th>Clock Out</th><th>Worked</th><th>Status</th></tr></thead>
          <tbody>
            {reports.length === 0 && (
              <tr><td colSpan={6} style={{ color: "var(--ink-soft)", textAlign: "center", padding: 20 }}>No direct reports yet.</td></tr>
            )}
            {reports.map((e) => {
              const a = todayById.get(e.id);
              return (
                <tr key={e.id}>
                  <td><div className="emp-cell"><div className="emp-avatar">{e.avatar}</div><span className="emp-name">{e.name}</span></div></td>
                  <td>{deptName(e.deptId)}</td>
                  <td>{formatClock(a?.clockIn)}</td>
                  <td>{formatClock(a?.clockOut)}</td>
                  <td>{a?.workedSec ? formatDuration(a.workedSec) : "—"}</td>
                  <td><Badge status={a?.status || "Absent"} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pending leave for my reports — read-only (approval is admin-only) */}
      <div className="card" style={{ padding: 0, marginBottom: 18 }}>
        <div style={{ padding: "18px 20px 6px" }}>
          <div className="card-title">Team Leave Requests</div>
          <div className="card-sub">Pending requests from your reports — decisions are made by an admin</div>
        </div>
        <table>
          <thead><tr><th>Employee</th><th>Type</th><th>Dates</th><th>Days</th><th>Reason</th><th>Status</th></tr></thead>
          <tbody>
            {pendingLeaves.length === 0 && (
              <tr><td colSpan={6} style={{ color: "var(--ink-soft)", textAlign: "center", padding: 20 }}>No pending leave requests 🎉</td></tr>
            )}
            {pendingLeaves.map((l) => {
              const e = reports.find((r) => r.id === l.employeeId);
              return (
                <tr key={l.id}>
                  <td><div className="emp-cell"><div className="emp-avatar">{e?.avatar}</div><span className="emp-name">{e?.name}</span></div></td>
                  <td>{l.type}</td>
                  <td>{l.from} → {l.to}</td>
                  <td>{l.days}</td>
                  <td style={{ color: "var(--ink-soft)" }}>{l.reason}</td>
                  <td><Badge status={l.status} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pending regularization approvals for my reports */}
      <RegularizationApprovals />
    </>
  );
}
