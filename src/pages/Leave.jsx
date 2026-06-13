import { useState } from "react";
import { X } from "lucide-react";
import { useData } from "../data/DataContext";
import { useAuth } from "../auth/AuthContext";
import { LEAVE_TYPES, balancesFor, validateLeaveRequest, leaveDays } from "../../shared/leave";
import Badge from "../components/Badge";

export default function Leave() {
  const { user, isAdmin } = useAuth();
  const { leaves, setLeaveStatus, cancelLeave, applyLeave, empName, empAvatar } = useData();
  const [tab, setTab] = useState("All");

  // Apply-for-leave modal state.
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ type: "Casual", from: "", to: "", reason: "" });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  // Admin decision modal (review details + optional comment).
  const [decision, setDecision] = useState(null);   // { leave, action }
  const [comment, setComment] = useState("");
  const [deciding, setDeciding] = useState(false);
  const [cancelId, setCancelId] = useState(null);    // id being cancelled

  function openDecision(leave, action) {
    setComment("");
    setDecision({ leave, action });
  }
  async function confirmDecision() {
    setDeciding(true);
    try {
      await setLeaveStatus(decision.leave.id, decision.action, comment.trim());
      setDecision(null);
    } finally {
      setDeciding(false);
    }
  }
  async function doCancel(id) {
    setCancelId(id);
    try { await cancelLeave(id); } catch { /* surfaced via list refresh */ }
    finally { setCancelId(null); }
  }

  const tabs = ["All", "Pending", "Approved", "Rejected"];
  const shown = tab === "All" ? leaves : leaves.filter((r) => r.status === tab);

  // The signed-in person's own balances, from the shared leave policy.
  const myLeaves = leaves.filter((l) => l.employeeId === user.id);
  const balances = balancesFor(myLeaves, user.id);

  // Live validation against my own leaves for instant feedback (the backend
  // re-validates on submit, so this is just UX).
  const check = validateLeaveRequest(myLeaves, user.id, form);
  const days = leaveDays(form.from, form.to);

  async function submitLeave(e) {
    e.preventDefault();
    setFormError(null);
    if (!check.ok) { setFormError(check.error); return; }
    setSubmitting(true);
    try {
      await applyLeave({ type: form.type, from: form.from, to: form.to, reason: form.reason });
      setOpen(false);
      setForm({ type: "Casual", from: "", to: "", reason: "" });
    } catch (err) {
      setFormError(err.message || "Could not submit the request.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="grid cols-4" style={{ marginBottom: 18 }}>
        {balances.map((b) => (
          <div key={b.type} className="card">
            <div className="stat-label">{b.type}</div>
            <div className="stat-value">
              {b.unlimited ? b.used : b.remaining}
              <span style={{ fontSize: 16, color: "var(--ink-soft)" }}>
                {b.unlimited ? " used" : ` / ${b.entitlement} left`}
              </span>
            </div>
            {!b.unlimited && (
              <div style={{ height: 6, background: "var(--line)", borderRadius: 999, marginTop: 12, overflow: "hidden" }}>
                <div style={{ width: `${Math.min(100, (b.used / b.entitlement) * 100)}%`, height: "100%", background: "var(--teal)" }} />
              </div>
            )}
            {b.pending > 0 && <div className="stat-delta" style={{ color: "var(--amber)" }}>{b.pending} day(s) pending</div>}
          </div>
        ))}
      </div>

      <div className="section-head">
        <div className="filters" style={{ margin: 0 }}>
          {tabs.map((t) => (
            <span key={t} className={`chip ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>{t}</span>
          ))}
        </div>
        <button className="btn primary" onClick={() => setOpen(true)}>+ Apply for Leave</button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead><tr><th>Employee</th><th>Type</th><th>Dates</th><th>Days</th><th>Reason</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {shown.length === 0 && (
              <tr><td colSpan={7} style={{ color: "var(--ink-soft)", textAlign: "center", padding: 24 }}>No leave requests here.</td></tr>
            )}
            {shown.map((l) => {
              const mine = l.employeeId === user.id;
              // Leave approval is admins-only; everyone else sees status only.
              const actionable = isAdmin && !mine && l.status === "Pending";
              const canCancel = mine && l.status === "Pending";
              return (
                <tr key={l.id}>
                  <td><div className="emp-cell"><div className="emp-avatar">{empAvatar(l.employeeId)}</div><span className="emp-name">{empName(l.employeeId)}{mine ? " (you)" : ""}</span></div></td>
                  <td>{l.type}</td>
                  <td>{l.from} → {l.to}</td>
                  <td>{l.days}</td>
                  <td style={{ color: "var(--ink-soft)" }}>
                    {l.reason}
                    {l.decisionComment && (
                      <div style={{ fontSize: 12, marginTop: 4 }}><b>Admin note:</b> {l.decisionComment}</div>
                    )}
                  </td>
                  <td><Badge status={l.status} /></td>
                  <td style={{ textAlign: "right" }}>
                    {actionable ? (
                      <>
                        <button className="btn primary sm" style={{ marginRight: 6 }} onClick={() => openDecision(l, "Approved")}>Approve</button>
                        <button className="btn ghost sm" onClick={() => openDecision(l, "Rejected")}>Decline</button>
                      </>
                    ) : canCancel ? (
                      <button className="btn ghost sm" disabled={cancelId === l.id} onClick={() => doCancel(l.id)}>
                        {cancelId === l.id ? "Cancelling…" : "Cancel request"}
                      </button>
                    ) : (
                      <span style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Apply-for-leave modal */}
      {open && (
        <div className="modal-overlay" onClick={() => !submitting && setOpen(false)}>
          <form className="modal modal-form" onClick={(e) => e.stopPropagation()} onSubmit={submitLeave}>
            <button type="button" className="modal-close" onClick={() => setOpen(false)} disabled={submitting} aria-label="Close"><X size={18} /></button>
            <div className="modal-title" style={{ textAlign: "left" }}>Apply for Leave</div>
            <div className="modal-message" style={{ textAlign: "left", margin: "6px 0 16px" }}>
              Submit a request — it lands in the approvals queue as Pending.
            </div>

            {formError && <div className="form-error">{formError}</div>}

            <div className="field">
              <label className="field-label">Type</label>
              <select className="field-control" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {LEAVE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="field-row">
              <div className="field">
                <label className="field-label">From</label>
                <input type="date" className="field-control" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} required />
              </div>
              <div className="field">
                <label className="field-label">To</label>
                <input type="date" className="field-control" value={form.to} min={form.from || undefined} onChange={(e) => setForm({ ...form, to: e.target.value })} required />
              </div>
            </div>

            <div className="field">
              <label className="field-label">Reason</label>
              <input className="field-control" value={form.reason} placeholder="Optional note for your manager" onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            </div>

            {/* Live balance feedback before submitting. */}
            {form.from && form.to && (
              <div style={{ fontSize: 12.5, color: check.ok ? "var(--ink-soft)" : "var(--rose)", marginTop: 4 }}>
                {check.ok ? `${days} day(s) requested.` : check.error}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
              <button type="button" className="btn ghost" onClick={() => setOpen(false)} disabled={submitting}>Cancel</button>
              <button type="submit" className="btn primary" disabled={submitting || !check.ok}>
                {submitting ? "Submitting…" : "Submit request"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Admin decision modal — review details + optional note to the employee */}
      {decision && (
        <div className="modal-overlay" onClick={() => !deciding && setDecision(null)}>
          <div className="modal modal-form" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="modal-close" onClick={() => setDecision(null)} disabled={deciding} aria-label="Close"><X size={18} /></button>
            <div className="modal-title" style={{ textAlign: "left" }}>
              {decision.action === "Approved" ? "Approve" : "Decline"} leave request
            </div>
            <div className="modal-message" style={{ textAlign: "left", margin: "6px 0 14px" }}>
              {empName(decision.leave.employeeId)} · {decision.leave.type} · {decision.leave.from} → {decision.leave.to} ({decision.leave.days} day{decision.leave.days === 1 ? "" : "s"})
              {decision.leave.reason ? ` · "${decision.leave.reason}"` : ""}
            </div>

            <div className="field">
              <label className="field-label">{decision.action === "Approved" ? "Note (optional)" : "Reason (optional)"}</label>
              <input className="field-control" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={140}
                placeholder={decision.action === "Approved" ? "Visible to the employee" : "Why it was declined"} autoFocus />
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn ghost" onClick={() => setDecision(null)} disabled={deciding}>Cancel</button>
              <button type="button" className={`btn ${decision.action === "Approved" ? "primary" : "danger"}`} onClick={confirmDecision} disabled={deciding}>
                {deciding ? "Saving…" : decision.action === "Approved" ? "Approve" : "Decline"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
