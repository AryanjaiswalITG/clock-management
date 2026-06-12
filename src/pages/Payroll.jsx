import { useState } from "react";
import { useData } from "../data/DataContext";
import Badge from "../components/Badge";

// Simple deterministic salary model for the demo
const baseFor = (id) => 4200 + ((id * 737) % 3800);
function payslip(emp) {
  const base = baseFor(emp.id);
  const hra = Math.round(base * 0.4);
  const gross = base + hra;
  const tax = Math.round(gross * 0.12);
  const pf = Math.round(base * 0.06);
  const net = gross - tax - pf;
  return { base, hra, gross, tax, pf, net };
}
const money = (n) => "$" + n.toLocaleString("en-US");

// The pay period is the current month, not a frozen label.
const PERIOD = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

export default function Payroll() {
  const { employees, deptName } = useData();
  const [processed, setProcessed] = useState(false);

  const slips = employees.map((e) => ({ emp: e, ...payslip(e) }));
  const totalGross = slips.reduce((s, x) => s + x.gross, 0);
  const totalNet = slips.reduce((s, x) => s + x.net, 0);
  // Deductions = tax + provident fund (both come out of gross to reach net).
  const totalDeductions = slips.reduce((s, x) => s + x.tax + x.pf, 0);

  // Download the run as a CSV the user can open in Excel/Sheets.
  function exportCsv() {
    const head = ["Employee", "Department", "Base", "HRA", "Gross", "Tax", "PF", "Net Pay", "Status"];
    const rows = slips.map(({ emp, base, hra, gross, tax, pf, net }) => [
      emp.name, deptName(emp.deptId), base, hra, gross, tax, pf, net, processed ? "Paid" : "Pending",
    ]);
    const csv = [head, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `payroll-${PERIOD.replace(" ", "-").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="grid cols-4" style={{ marginBottom: 18 }}>
        <div className="card"><div className="stat-label">Pay Period</div><div className="stat-value" style={{ fontSize: 22 }}>{PERIOD}</div><div className={`stat-delta ${processed ? "up" : ""}`}>{processed ? "Processed" : "Run open"}</div></div>
        <div className="card"><div className="stat-label">Total Gross</div><div className="stat-value" style={{ fontSize: 26 }}>{money(totalGross)}</div></div>
        <div className="card"><div className="stat-label">Total Deductions</div><div className="stat-value" style={{ fontSize: 26 }}>{money(totalDeductions)}</div></div>
        <div className="card"><div className="stat-label">Net Payable</div><div className="stat-value" style={{ fontSize: 26, color: "var(--teal)" }}>{money(totalNet)}</div></div>
      </div>

      <div className="section-head">
        <h2>Payroll Run — {PERIOD}</h2>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn ghost" onClick={exportCsv}>Export CSV</button>
          <button className="btn primary" onClick={() => setProcessed(true)} disabled={processed}>
            {processed ? "Payroll Processed ✓" : "Process Payroll"}
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead><tr><th>Employee</th><th>Department</th><th>Base</th><th>HRA</th><th>Gross</th><th>Tax</th><th>PF</th><th>Net Pay</th><th>Status</th></tr></thead>
          <tbody>
            {slips.map(({ emp, base, hra, gross, tax, pf, net }) => (
              <tr key={emp.id}>
                <td><div className="emp-cell"><div className="emp-avatar">{emp.avatar}</div><span className="emp-name">{emp.name}</span></div></td>
                <td>{deptName(emp.deptId)}</td>
                <td>{money(base)}</td>
                <td>{money(hra)}</td>
                <td>{money(gross)}</td>
                <td style={{ color: "var(--rose)" }}>−{money(tax)}</td>
                <td style={{ color: "var(--rose)" }}>−{money(pf)}</td>
                <td style={{ fontWeight: 600 }}>{money(net)}</td>
                <td><Badge status={processed ? "Paid" : "Pending"} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
