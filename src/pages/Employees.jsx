import { useState } from "react";
import { useData } from "../data/DataContext";
import Badge from "../components/Badge";

export default function Employees() {
  const { employees, departments, deptName, loading } = useData();
  const [dept, setDept] = useState(0);
  const [q, setQ] = useState("");

  const filtered = employees.filter((e) =>
    (dept === 0 || e.deptId === dept) &&
    (e.name.toLowerCase().includes(q.toLowerCase()) || e.designation.toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <>
      <div className="section-head">
        <h2>{loading ? "…" : filtered.length} People</h2>
        <button className="btn primary">+ Add Employee</button>
      </div>

      <div className="filters">
        <span className={`chip ${dept === 0 ? "active" : ""}`} onClick={() => setDept(0)}>All</span>
        {departments.map((d) => (
          <span key={d.id} className={`chip ${dept === d.id ? "active" : ""}`} onClick={() => setDept(d.id)}>{d.name}</span>
        ))}
        <input
          placeholder="Search by name or role…"
          value={q} onChange={(e) => setQ(e.target.value)}
          style={{ marginLeft: "auto", padding: "7px 14px", borderRadius: 999, border: "1px solid var(--line)", fontFamily: "inherit", fontSize: 13, outline: "none", minWidth: 220 }}
        />
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead><tr><th>Employee</th><th>Department</th><th>Email</th><th>Joined</th><th>Status</th></tr></thead>
          <tbody>
            {filtered.map((e) => (
              <tr key={e.id}>
                <td>
                  <div className="emp-cell">
                    <div className="emp-avatar">{e.avatar}</div>
                    <div><div className="emp-name">{e.name}</div><div className="emp-meta">{e.designation}</div></div>
                  </div>
                </td>
                <td>{deptName(e.deptId)}</td>
                <td style={{ color: "var(--ink-soft)" }}>{e.email}</td>
                <td>{new Date(e.joinDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</td>
                <td><Badge status={e.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
