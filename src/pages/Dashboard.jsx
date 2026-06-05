import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Users, UserCheck, Plane, Clock } from "lucide-react";
import { useData } from "../data/DataContext";
import Badge from "../components/Badge";

const PIE = ["#0f6e63", "#d98a2b", "#2f8f5b", "#c2484d", "#5a6b65"];

// Demo weekly trend (static chart data).
const attendanceTrend = [
  { day: "Mon", present: 7, absent: 1 },
  { day: "Tue", present: 8, absent: 0 },
  { day: "Wed", present: 6, absent: 2 },
  { day: "Thu", present: 7, absent: 1 },
  { day: "Fri", present: 6, absent: 2 },
];

function Stat({ icon: Icon, label, value, delta, tone }) {
  return (
    <div className="card">
      <div className="row-between">
        <div className="stat-label"><Icon size={15} /> {label}</div>
        <div className="stat-icon" style={{ background: "var(--teal-soft)" }}><Icon size={17} color="var(--teal)" /></div>
      </div>
      <div className="stat-value">{value}</div>
      {delta && <div className={`stat-delta ${tone}`}>{delta}</div>}
    </div>
  );
}

export default function Dashboard() {
  const { employees, attendanceToday, leaves, headcountByDept, empName, empAvatar, loading } = useData();

  if (loading) return <div style={{ color: "var(--ink-soft)" }}>Loading dashboard…</div>;

  const present = attendanceToday.filter((a) => a.status === "Present" || a.status === "Working").length;
  const onLeave = employees.filter((e) => e.status === "On Leave").length;
  const pending = leaves.filter((l) => l.status === "Pending");
  const headcount = employees.length || 1;

  return (
    <>
      <div className="grid cols-4" style={{ marginBottom: 18 }}>
        <Stat icon={Users} label="Total Employees" value={employees.length} delta="+2 this quarter" tone="up" />
        <Stat icon={UserCheck} label="Present Today" value={present} delta={`${Math.round(present / headcount * 100)}% of team`} tone="up" />
        <Stat icon={Plane} label="On Leave" value={onLeave} delta="1 returning Mon" tone="up" />
        <Stat icon={Clock} label="Pending Approvals" value={pending.length} delta="Needs your action" tone="down" />
      </div>

      <div className="grid cols-2" style={{ marginBottom: 18 }}>
        <div className="card">
          <div className="card-title">Weekly Attendance</div>
          <div className="card-sub">Present vs absent across the team</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={attendanceTrend} barGap={6}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
              <XAxis dataKey="day" tickLine={false} axisLine={false} style={{ fontSize: 12 }} />
              <YAxis tickLine={false} axisLine={false} style={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid var(--line)", fontSize: 13 }} />
              <Bar dataKey="present" fill="#0f6e63" radius={[5, 5, 0, 0]} />
              <Bar dataKey="absent" fill="#e4c39a" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-title">Headcount by Department</div>
          <div className="card-sub">Distribution across teams</div>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={headcountByDept} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={3}>
                {headcountByDept.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid var(--line)", fontSize: 13 }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
            {headcountByDept.map((d, i) => (
              <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--ink-soft)" }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: PIE[i % PIE.length] }} /> {d.name}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="row-between" style={{ marginBottom: 8 }}>
          <div>
            <div className="card-title">Pending Leave Approvals</div>
            <div className="card-sub">Requests waiting on a manager decision</div>
          </div>
          <button className="btn ghost sm">View all</button>
        </div>
        <table>
          <thead><tr><th>Employee</th><th>Type</th><th>Dates</th><th>Days</th><th>Status</th></tr></thead>
          <tbody>
            {pending.map((l) => (
              <tr key={l.id}>
                <td><div className="emp-cell"><div className="emp-avatar">{empAvatar(l.employeeId)}</div><span className="emp-name">{empName(l.employeeId)}</span></div></td>
                <td>{l.type}</td>
                <td>{l.from} → {l.to}</td>
                <td>{l.days}</td>
                <td><Badge status={l.status} /></td>
              </tr>
            ))}
            {pending.length === 0 && (
              <tr><td colSpan={5} style={{ color: "var(--ink-soft)", textAlign: "center", padding: 20 }}>No pending approvals 🎉</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
