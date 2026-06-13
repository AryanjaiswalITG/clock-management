import { useState } from "react";
import { UserPlus, Trash2, X, Check, AlertTriangle, Archive, Pencil, Building2 } from "lucide-react";
import { useData } from "../data/DataContext";
import { useAuth } from "../auth/AuthContext";
import Badge from "../components/Badge";
import Avatar from "../components/Avatar";
import { isNewcomer } from "../../shared/newcomer";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMPTY_FORM = { name: "", email: "", password: "", confirm: "" };
const ROLES = ["employee", "manager", "admin"];

export default function Employees() {
  const { employees, departments, deptName, deletedEmployees, loading, createEmployee, updateEmployee, deleteEmployees, createDepartment } = useData();
  const { user } = useAuth();
  const [dept, setDept] = useState(0);
  const [q, setQ] = useState("");

  const [selected, setSelected] = useState([]);        // ids checked for deletion
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [delBusy, setDelBusy] = useState(false);
  const [error, setError] = useState(null);

  // Admin: edit an employee's org placement / status.
  const [editEmp, setEditEmp] = useState(null);     // the employee being edited
  const [editForm, setEditForm] = useState(null);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState(null);

  // Admin: add a department.
  const [showDept, setShowDept] = useState(false);
  const [deptName_, setDeptName_] = useState("");
  const [deptBusy, setDeptBusy] = useState(false);
  const [deptError, setDeptError] = useState(null);

  const filtered = employees.filter((e) =>
    (dept === 0 || e.deptId === dept) &&
    (e.name.toLowerCase().includes(q.toLowerCase()) || e.designation.toLowerCase().includes(q.toLowerCase()))
  );

  // Everyone selectable in the current view (you can't delete yourself).
  const selectableIds = filtered.filter((e) => e.id !== user?.id).map((e) => e.id);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.includes(id));

  const toggle = (id) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const toggleAll = () =>
    setSelected(allSelected ? [] : selectableIds);

  const selectedEmployees = employees.filter((e) => selected.includes(e.id));

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submitAdd(e) {
    e.preventDefault();
    setAddError(null);
    const name = form.name.trim();
    const email = form.email.trim();
    if (!name) return setAddError("Full name is required");
    if (!EMAIL_RE.test(email)) return setAddError("Please enter a valid email address");
    if (form.password.length < 6) return setAddError("Password must be at least 6 characters");
    if (form.password !== form.confirm) return setAddError("Passwords do not match");
    setAddBusy(true);
    try {
      await createEmployee({ name, email, password: form.password });
      setShowAdd(false);
      setForm(EMPTY_FORM);
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAddBusy(false);
    }
  }

  function startEdit(e) {
    setEditError(null);
    setEditForm({
      designation: e.designation,
      deptId: e.deptId,
      managerId: e.managerId ?? "",
      role: e.role,
      status: e.status === "Inactive" ? "Inactive" : "Active",
    });
    setEditEmp(e);
  }

  async function submitEdit(ev) {
    ev.preventDefault();
    setEditError(null);
    setEditBusy(true);
    try {
      await updateEmployee(editEmp.id, {
        designation: editForm.designation.trim(),
        deptId: Number(editForm.deptId),
        managerId: editForm.managerId === "" ? null : Number(editForm.managerId),
        role: editForm.role,
        status: editForm.status,
      });
      setEditEmp(null);
      setEditForm(null);
    } catch (err) {
      setEditError(err.message);
    } finally {
      setEditBusy(false);
    }
  }

  async function submitDept(ev) {
    ev.preventDefault();
    setDeptError(null);
    if (!deptName_.trim()) return setDeptError("Department name is required");
    setDeptBusy(true);
    try {
      await createDepartment(deptName_.trim());
      setShowDept(false);
      setDeptName_("");
    } catch (err) {
      setDeptError(err.message);
    } finally {
      setDeptBusy(false);
    }
  }

  async function doDelete() {
    setDelBusy(true);
    setError(null);
    try {
      await deleteEmployees(selected);
      setSelected([]);
      setConfirmDel(false);
    } catch (err) {
      setError(err.message);
      setConfirmDel(false);
    } finally {
      setDelBusy(false);
    }
  }

  return (
    <>
      <div className="section-head">
        <h2>{loading ? "…" : filtered.length} People</h2>
        <div className="head-actions">
          <button className="btn danger-outline" disabled={selected.length === 0} onClick={() => setConfirmDel(true)}>
            <Trash2 size={15} style={{ marginRight: 7, verticalAlign: "-2px" }} />
            Delete Employee{selected.length > 1 ? `s (${selected.length})` : ""}
          </button>
          <button className="btn ghost" onClick={() => { setDeptError(null); setDeptName_(""); setShowDept(true); }}>
            <Building2 size={15} style={{ marginRight: 7, verticalAlign: "-2px" }} /> Add Department
          </button>
          <button className="btn primary" onClick={() => { setAddError(null); setForm(EMPTY_FORM); setShowAdd(true); }}>
            <UserPlus size={15} style={{ marginRight: 7, verticalAlign: "-2px" }} /> Add Employee
          </button>
        </div>
      </div>

      {error && (
        <div className="card" style={{ marginBottom: 14, borderColor: "var(--rose)", color: "var(--rose)", display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={16} /> {error}
        </div>
      )}

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
          <thead>
            <tr>
              <th style={{ width: 44 }}>
                <input type="checkbox" aria-label="Select all" checked={allSelected}
                  onChange={toggleAll} disabled={selectableIds.length === 0} />
              </th>
              <th>Employee</th><th>Department</th><th>Email</th><th>Joined</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => {
              const isSelf = e.id === user?.id;
              const checked = selected.includes(e.id);
              return (
                <tr key={e.id} className={checked ? "row-selected" : ""}>
                  <td>
                    <input type="checkbox" checked={checked} disabled={isSelf}
                      onChange={() => toggle(e.id)}
                      aria-label={isSelf ? "You can't delete your own account" : `Select ${e.name}`}
                      title={isSelf ? "You can't delete your own account" : undefined} />
                  </td>
                  <td>
                    <div className="emp-cell">
                      <Avatar src={e.avatarUrl} initials={e.avatar} className="emp-avatar" />
                      <div><div className="emp-name">{e.name}</div><div className="emp-meta">{e.designation}</div></div>
                    </div>
                  </td>
                  <td>{deptName(e.deptId)}</td>
                  <td style={{ color: "var(--ink-soft)" }}>{e.email}</td>
                  <td>{new Date(e.joinDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</td>
                  <td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <Badge status={e.status} />
                      {isNewcomer(e) && <Badge status="Newly" />}
                    </div>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button className="btn ghost sm" onClick={() => startEdit(e)} title={`Edit ${e.name}`}>
                      <Pencil size={14} style={{ marginRight: 6, verticalAlign: "-2px" }} /> Edit
                    </button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && !loading && (
              <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--ink-soft)", padding: 24 }}>No employees match.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ---- Old Employees (archive of admin-removed employees) ---- */}
      {deletedEmployees.length > 0 && (
        <div className="card" style={{ padding: 0, marginTop: 18 }}>
          <div style={{ padding: "18px 20px 6px" }}>
            <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}><Archive size={17} /> Old Employees</div>
            <div className="card-sub">Employees removed by an admin — kept for the record</div>
          </div>
          <table>
            <thead><tr><th>Employee</th><th>Department</th><th>Email</th><th>Added on</th><th>Deleted on</th></tr></thead>
            <tbody>
              {deletedEmployees.map((e) => (
                <tr key={`${e.id}-${e.deletedAt}`}>
                  <td>
                    <div className="emp-cell">
                      <Avatar src={e.avatarUrl} initials={e.avatar} className="emp-avatar" />
                      <div><div className="emp-name">{e.name}</div><div className="emp-meta">{e.designation}</div></div>
                    </div>
                  </td>
                  <td>{deptName(e.deptId)}</td>
                  <td style={{ color: "var(--ink-soft)" }}>{e.email}</td>
                  <td>{e.addedAt ? new Date(e.addedAt).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : "—"}</td>
                  <td>{e.deletedAt ? new Date(e.deletedAt).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ---- Add Employee modal ---- */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => !addBusy && setShowAdd(false)}>
          <form className="modal modal-form" onClick={(e) => e.stopPropagation()} onSubmit={submitAdd}>
            <button type="button" className="modal-close" onClick={() => setShowAdd(false)} disabled={addBusy} aria-label="Close"><X size={18} /></button>
            <div className="modal-title" style={{ textAlign: "left" }}>Add Employee</div>
            <div className="modal-message" style={{ textAlign: "left", margin: "6px 0 16px" }}>Create a new employee account.</div>

            {addError && <div className="form-error">{addError}</div>}

            <div className="field">
              <label className="field-label">Full name</label>
              <input className="field-control" value={form.name} onChange={set("name")} maxLength={60} autoFocus />
            </div>
            <div className="field">
              <label className="field-label">Email address</label>
              <input className="field-control" type="email" value={form.email} onChange={set("email")} />
            </div>
            <div className="field-row">
              <div className="field">
                <label className="field-label">Password</label>
                <input className="field-control" type="password" value={form.password} onChange={set("password")} />
              </div>
              <div className="field">
                <label className="field-label">Confirm password</label>
                <input className="field-control" type="password" value={form.confirm} onChange={set("confirm")} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn ghost" onClick={() => setShowAdd(false)} disabled={addBusy}>Cancel</button>
              <button type="submit" className="btn primary" disabled={addBusy}>
                <Check size={15} style={{ marginRight: 6, verticalAlign: "-2px" }} /> {addBusy ? "Creating…" : "Create employee"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ---- Edit employee (admin: department / manager / role / status) ---- */}
      {editEmp && editForm && (
        <div className="modal-overlay" onClick={() => !editBusy && setEditEmp(null)}>
          <form className="modal modal-form" onClick={(ev) => ev.stopPropagation()} onSubmit={submitEdit}>
            <button type="button" className="modal-close" onClick={() => setEditEmp(null)} disabled={editBusy} aria-label="Close"><X size={18} /></button>
            <div className="modal-title" style={{ textAlign: "left" }}>Edit {editEmp.name}</div>
            <div className="modal-message" style={{ textAlign: "left", margin: "6px 0 16px" }}>
              Manage this employee's organizational placement and status.
            </div>

            {editError && <div className="form-error">{editError}</div>}

            <div className="field">
              <label className="field-label">Designation</label>
              <input className="field-control" value={editForm.designation}
                onChange={(ev) => setEditForm((f) => ({ ...f, designation: ev.target.value }))} maxLength={60} />
            </div>

            <div className="field-row">
              <div className="field">
                <label className="field-label">Department</label>
                <select className="field-control" value={editForm.deptId}
                  onChange={(ev) => setEditForm((f) => ({ ...f, deptId: ev.target.value }))}>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label className="field-label">Reporting manager</label>
                <select className="field-control" value={editForm.managerId}
                  onChange={(ev) => setEditForm((f) => ({ ...f, managerId: ev.target.value }))}>
                  <option value="">— None —</option>
                  {employees.filter((m) => m.id !== editEmp.id).map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="field-row">
              <div className="field">
                <label className="field-label">Role</label>
                <select className="field-control" value={editForm.role}
                  onChange={(ev) => setEditForm((f) => ({ ...f, role: ev.target.value }))}
                  style={{ textTransform: "capitalize" }}>
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="field">
                <label className="field-label">Status</label>
                <select className="field-control" value={editForm.status}
                  onChange={(ev) => setEditForm((f) => ({ ...f, status: ev.target.value }))}>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn ghost" onClick={() => setEditEmp(null)} disabled={editBusy}>Cancel</button>
              <button type="submit" className="btn primary" disabled={editBusy}>
                <Check size={15} style={{ marginRight: 6, verticalAlign: "-2px" }} /> {editBusy ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ---- Add department ---- */}
      {showDept && (
        <div className="modal-overlay" onClick={() => !deptBusy && setShowDept(false)}>
          <form className="modal modal-form" onClick={(ev) => ev.stopPropagation()} onSubmit={submitDept}>
            <button type="button" className="modal-close" onClick={() => setShowDept(false)} disabled={deptBusy} aria-label="Close"><X size={18} /></button>
            <div className="modal-title" style={{ textAlign: "left" }}>Add Department</div>
            <div className="modal-message" style={{ textAlign: "left", margin: "6px 0 16px" }}>Create a new department for the org.</div>

            {deptError && <div className="form-error">{deptError}</div>}

            <div className="field">
              <label className="field-label">Department name</label>
              <input className="field-control" value={deptName_} onChange={(ev) => setDeptName_(ev.target.value)} maxLength={40} autoFocus placeholder="e.g. Marketing" />
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn ghost" onClick={() => setShowDept(false)} disabled={deptBusy}>Cancel</button>
              <button type="submit" className="btn primary" disabled={deptBusy}>
                <Check size={15} style={{ marginRight: 6, verticalAlign: "-2px" }} /> {deptBusy ? "Creating…" : "Create department"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ---- Delete confirmation ---- */}
      {confirmDel && (
        <div className="modal-overlay" onClick={() => !delBusy && setConfirmDel(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setConfirmDel(false)} disabled={delBusy} aria-label="Close"><X size={18} /></button>
            <div className="modal-icon"><Trash2 size={26} color="var(--rose)" /></div>
            <div className="modal-title">Delete {selected.length} employee{selected.length === 1 ? "" : "s"}?</div>
            <div className="modal-message">
              {selectedEmployees.map((e) => e.name).join(", ")} will be removed (with their attendance and leave records) and moved to <b>Old Employees</b>. This can't be undone.
            </div>
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setConfirmDel(false)} disabled={delBusy}>Cancel</button>
              <button className="btn danger" onClick={doDelete} disabled={delBusy} autoFocus>
                {delBusy ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
