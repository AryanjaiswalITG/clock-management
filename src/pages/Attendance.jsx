import { useState, useEffect } from "react";
import { useData } from "../data/DataContext";
import { formatClock, formatDuration } from "../utils/time";
import Badge from "../components/Badge";

export default function Attendance() {
  const { attendanceToday, empName, empAvatar, empById, deptName } = useData();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const fmt = (d) => d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const count = (s) => attendanceToday.filter((a) => a.status === s).length;

  return (
    <>
      <div className="grid cols-2" style={{ marginBottom: 18 }}>
        <div className="card panel-invert" style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center" }}>
          <div style={{ fontSize: 13, color: "var(--panel-ink-soft)", letterSpacing: ".1em", textTransform: "uppercase" }}>
            {now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 52, fontWeight: 600, margin: "6px 0" }}>{fmt(now)}</div>
          <div style={{ fontSize: 13, color: "var(--panel-ink-soft)" }}>Team attendance · live</div>
        </div>

        <div className="card">
          <div className="card-title">Today at a glance</div>
          <div className="card-sub">{now.toDateString()}</div>
          {[
            ["Present (clocked out)", count("Present"), "green"],
            ["Currently working", count("Working"), "teal"],
            ["Absent", count("Absent"), "rose"],
          ].map(([label, n]) => (
            <div key={label} className="row-between" style={{ padding: "11px 0", borderBottom: "1px solid var(--line)" }}>
              <span style={{ fontSize: 14 }}>{label}</span>
              <span style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600 }}>{n}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: "18px 20px 6px" }}>
          <div className="card-title">Attendance Log — Today</div>
        </div>
        <table>
          <thead><tr><th>Employee</th><th>Department</th><th>Clock In</th><th>Clock Out</th><th>Worked</th><th>Status</th></tr></thead>
          <tbody>
            {attendanceToday.map((a) => {
              const emp = empById(a.employeeId);
              return (
                <tr key={a.employeeId}>
                  <td><div className="emp-cell"><div className="emp-avatar">{empAvatar(a.employeeId)}</div><span className="emp-name">{empName(a.employeeId)}</span></div></td>
                  <td>{deptName(emp?.deptId)}</td>
                  <td>{formatClock(a.clockIn)}</td>
                  <td>{formatClock(a.clockOut)}</td>
                  <td>{a.workedSec ? formatDuration(a.workedSec) : "—"}</td>
                  <td><Badge status={a.status} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
