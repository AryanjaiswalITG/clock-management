import { useData } from "../data/DataContext";

function Node({ emp, reports, deptName }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div className="card" style={{ textAlign: "center", minWidth: 180, padding: "16px 18px" }}>
        <div className="emp-avatar" style={{ width: 44, height: 44, fontSize: 15, margin: "0 auto 10px" }}>{emp.avatar}</div>
        <div className="emp-name">{emp.name}</div>
        <div className="emp-meta">{emp.designation}</div>
        <div style={{ marginTop: 8 }}><span className="badge teal">{deptName(emp.deptId)}</span></div>
      </div>
      {reports.length > 0 && (
        <>
          <div style={{ width: 2, height: 22, background: "var(--line)" }} />
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", justifyContent: "center" }}>
            {reports.map((r) => (
              <div key={r.id} className="card" style={{ textAlign: "center", minWidth: 160, padding: "14px 16px" }}>
                <div className="emp-avatar" style={{ margin: "0 auto 8px" }}>{r.avatar}</div>
                <div className="emp-name" style={{ fontSize: 14 }}>{r.name}</div>
                <div className="emp-meta">{r.designation}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function Org() {
  const { employees, deptName } = useData();
  const leads = employees.filter((e) => e.managerId === null);
  return (
    <>
      <div className="section-head"><h2>Organization Chart</h2></div>
      <div style={{ display: "flex", gap: 40, flexWrap: "wrap", alignItems: "flex-start" }}>
        {leads.map((lead) => (
          <Node key={lead.id} emp={lead} deptName={deptName} reports={employees.filter((e) => e.managerId === lead.id)} />
        ))}
      </div>
    </>
  );
}
