import { useState, useEffect, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { CalendarRange, CalendarDays } from "lucide-react";
import { api } from "../api";
import { useData } from "../data/DataContext";
import { formatClock, formatDuration } from "../utils/time";
import Badge from "../components/Badge";
import MonthPicker from "../components/MonthPicker";
import { SUMMARY_ITEMS, styleFor } from "../components/attendanceStatus";

const TODAY = new Date();
const CUR_MONTH = { year: TODAY.getFullYear(), month: TODAY.getMonth() + 1 };

export default function Attendance() {
  const { attendanceToday, empName, empAvatar, empById, deptName } = useData();
  const [now, setNow] = useState(new Date());
  const [month, setMonth] = useState(CUR_MONTH);
  const [report, setReport] = useState(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    api.monthlyTeam(month).then((r) => { if (!cancelled) setReport(r); }).catch(() => {});
    return () => { cancelled = true; };
  }, [month]);

  const fmt = (d) => d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const count = (s) => attendanceToday.filter((a) => a.status === s).length;

  // Team-wide totals per status for the bar chart.
  const chartData = useMemo(() => {
    if (!report) return [];
    return SUMMARY_ITEMS.map(({ key, status }) => ({
      name: styleFor(status).label,
      value: report.rows.reduce((sum, r) => sum + (r.totals[key] || 0), 0),
      color: styleFor(status).color,
    }));
  }, [report]);

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

      <div className="card" style={{ padding: 0, marginBottom: 18 }}>
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

      {/* ---- Monthly report header ---- */}
      <div className="section-head" style={{ marginBottom: 12 }}>
        <h2 style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 20 }}><CalendarRange size={18} /> Monthly Report</h2>
        <MonthPicker value={month} onChange={setMonth} max={CUR_MONTH} />
      </div>

      <div className="grid cols-2" style={{ marginBottom: 18, alignItems: "start" }}>
        {/* Monthly status distribution chart */}
        <div className="card">
          <div className="card-title">Status Distribution</div>
          <div className="card-sub">Team-wide days by status this month</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} barCategoryGap="22%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} style={{ fontSize: 11.5 }} interval={0} />
              <YAxis tickLine={false} axisLine={false} allowDecimals={false} style={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid var(--line)", fontSize: 13 }} />
              <Bar dataKey="value" radius={[5, 5, 0, 0]}>
                {chartData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Weekend chart / report */}
        <div className="card">
          <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}><CalendarDays size={17} /> Weekends & Holidays</div>
          <div className="card-sub">
            {report ? `${report.weekends.length} weekend days · ${report.holidayDates.length} holiday${report.holidayDates.length === 1 ? "" : "s"}` : "Loading…"}
          </div>
          {report && (
            <>
              <div style={{ fontSize: 12.5, color: "var(--ink-soft)", margin: "12px 0 6px", fontWeight: 600 }}>Weekend days</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {report.weekends.length === 0 && <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>None configured.</span>}
                {report.weekends.map((d) => (
                  <span key={d} className="badge gray">
                    {new Date(`${d}T00:00:00`).toLocaleDateString("en-US", { weekday: "short", day: "numeric" })}
                  </span>
                ))}
              </div>
              {report.holidayDates.length > 0 && (
                <>
                  <div style={{ fontSize: 12.5, color: "var(--ink-soft)", margin: "14px 0 6px", fontWeight: 600 }}>Holidays</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {report.holidayDates.map((d) => (
                      <span key={d} className="badge teal">
                        {new Date(`${d}T00:00:00`).toLocaleDateString("en-US", { day: "numeric", month: "short" })}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Per-employee monthly totals */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: "18px 20px 6px" }}>
          <div className="card-title">Per-Employee Summary</div>
          <div className="card-sub">Complete monthly attendance for every employee</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Employee</th><th>Present</th><th>Half Day</th><th>Absent</th>
              <th>Leave</th><th>Weekend</th><th>Holiday</th><th>Working Days</th>
            </tr>
          </thead>
          <tbody>
            {!report && <tr><td colSpan={8} style={{ textAlign: "center", color: "var(--ink-soft)", padding: 20 }}>Loading…</td></tr>}
            {report?.rows.map((r) => (
              <tr key={r.employeeId}>
                <td><div className="emp-cell"><div className="emp-avatar">{empAvatar(r.employeeId)}</div><span className="emp-name">{r.name}</span></div></td>
                <td>{r.totals.present}</td>
                <td>{r.totals.halfDay}</td>
                <td>{r.totals.absent}</td>
                <td>{r.totals.leave}</td>
                <td>{r.totals.weekend}</td>
                <td>{r.totals.holiday}</td>
                <td>{r.totals.workingDays}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
