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

export default function Payroll() {
  const { employees, deptName } = useData();
  const slips = employees.map((e) => ({ emp: e, ...payslip(e) }));
  const totalGross = slips.reduce((s, x) => s + x.gross, 0);
  const totalNet = slips.reduce((s, x) => s + x.net, 0);
  const totalTax = slips.reduce((s, x) => s + x.tax, 0);

  return (
    <>
      <div className="grid cols-4" style={{ marginBottom: 18 }}>
        <div className="card"><div className="stat-label">Pay Period</div><div className="stat-value" style={{ fontSize: 22 }}>May 2026</div><div className="stat-delta up">Run open</div></div>
        <div className="card"><div className="stat-label">Total Gross</div><div className="stat-value" style={{ fontSize: 26 }}>{money(totalGross)}</div></div>
        <div className="card"><div className="stat-label">Total Deductions</div><div className="stat-value" style={{ fontSize: 26 }}>{money(totalTax)}</div></div>
        <div className="card"><div className="stat-label">Net Payable</div><div className="stat-value" style={{ fontSize: 26, color: "var(--teal)" }}>{money(totalNet)}</div></div>
      </div>

      <div className="section-head">
        <h2>Payroll Run — May 2026</h2>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn ghost">Export CSV</button>
          <button className="btn primary">Process Payroll</button>
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
                <td><Badge status="Pending" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
