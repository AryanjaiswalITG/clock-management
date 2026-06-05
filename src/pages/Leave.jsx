import { useState } from "react";
import { useData } from "../data/DataContext";
import Badge from "../components/Badge";

export default function Leave() {
  const { leaves, setLeaveStatus, empName, empAvatar } = useData();
  const [tab, setTab] = useState("All");

  const tabs = ["All", "Pending", "Approved", "Rejected"];
  const shown = tab === "All" ? leaves : leaves.filter((r) => r.status === tab);

  const balances = [
    ["Annual Leave", 18, 24], ["Sick Leave", 6, 12], ["Work From Home", 9, 99],
  ];

  return (
    <>
      <div className="grid cols-3" style={{ marginBottom: 18 }}>
        {balances.map(([name, used, total]) => (
          <div key={name} className="card">
            <div className="stat-label">{name}</div>
            <div className="stat-value">{total === 99 ? used : total - used}<span style={{ fontSize: 16, color: "var(--ink-soft)" }}>{total === 99 ? " used" : ` / ${total} left`}</span></div>
            {total !== 99 && (
              <div style={{ height: 6, background: "var(--line)", borderRadius: 999, marginTop: 12, overflow: "hidden" }}>
                <div style={{ width: `${(used / total) * 100}%`, height: "100%", background: "var(--teal)" }} />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="section-head">
        <div className="filters" style={{ margin: 0 }}>
          {tabs.map((t) => (
            <span key={t} className={`chip ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>{t}</span>
          ))}
        </div>
        <button className="btn primary">+ Apply for Leave</button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead><tr><th>Employee</th><th>Type</th><th>Dates</th><th>Days</th><th>Reason</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {shown.map((l) => (
              <tr key={l.id}>
                <td><div className="emp-cell"><div className="emp-avatar">{empAvatar(l.employeeId)}</div><span className="emp-name">{empName(l.employeeId)}</span></div></td>
                <td>{l.type}</td>
                <td>{l.from} → {l.to}</td>
                <td>{l.days}</td>
                <td style={{ color: "var(--ink-soft)" }}>{l.reason}</td>
                <td><Badge status={l.status} /></td>
                <td style={{ textAlign: "right" }}>
                  {l.status === "Pending" ? (
                    <>
                      <button className="btn primary sm" style={{ marginRight: 6 }} onClick={() => setLeaveStatus(l.id, "Approved")}>Approve</button>
                      <button className="btn ghost sm" onClick={() => setLeaveStatus(l.id, "Rejected")}>Decline</button>
                    </>
                  ) : <span style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
