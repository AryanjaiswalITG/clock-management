import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { UserPlus, Lock, Mail, User, AlertCircle, CheckCircle2 } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useSettings } from "../settings/SettingsContext";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Signup() {
  const { register } = useAuth();
  const { companyName } = useSettings();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);     // server-side error banner
  const [touched, setTouched] = useState(false); // show inline validation after first submit attempt

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // Live client-side validation.
  const errors = {
    name: !form.name.trim() ? "Full name is required" : null,
    email: !EMAIL_RE.test(form.email.trim()) ? "Enter a valid email address" : null,
    password: form.password.length < 6 ? "Password must be at least 6 characters" : null,
    confirm:
      form.confirm.length === 0
        ? "Please confirm your password"
        : form.password !== form.confirm
        ? "Passwords do not match"
        : null,
  };
  const isValid = !errors.name && !errors.email && !errors.password && !errors.confirm;

  async function handleSubmit(e) {
    e.preventDefault();
    setTouched(true);
    setError(null);
    if (!isValid) return;
    setSubmitting(true);
    try {
      await register({ name: form.name.trim(), email: form.email.trim(), password: form.password });
      navigate("/", { replace: true }); // auto-signed-in -> dashboard
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Password match indicator (only once the user has typed a confirmation).
  const matchHint =
    form.confirm.length > 0 &&
    (form.password === form.confirm ? (
      <span className="match-ok"><CheckCircle2 size={13} /> Passwords match</span>
    ) : (
      <span className="match-bad"><AlertCircle size={13} /> Passwords do not match</span>
    ));

  const showErr = (key) => touched && errors[key];

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="brand" style={{ justifyContent: "center", paddingBottom: 8 }}>
          <div className="brand-mark">{(companyName[0] || "N").toUpperCase()}</div>
          <div className="brand-name" style={{ color: "var(--ink)" }}>{companyName}</div>
        </div>
        <h1 className="auth-title">Create your account</h1>
        <p className="auth-sub">Join {companyName} — it only takes a minute</p>

        {error && (
          <div className="auth-error"><AlertCircle size={15} /> {error}</div>
        )}

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <label className="auth-label">Full name</label>
          <div className={`auth-input ${showErr("name") ? "invalid" : ""}`}>
            <User size={16} />
            <input type="text" placeholder="Aryan Jaiswal" value={form.name} onChange={set("name")} />
          </div>
          {showErr("name") && <div className="auth-field-error">{errors.name}</div>}

          <label className="auth-label">Email</label>
          <div className={`auth-input ${showErr("email") ? "invalid" : ""}`}>
            <Mail size={16} />
            <input type="email" autoComplete="email" placeholder="you@company.com" value={form.email} onChange={set("email")} />
          </div>
          {showErr("email") && <div className="auth-field-error">{errors.email}</div>}

          <label className="auth-label">Password</label>
          <div className={`auth-input ${showErr("password") ? "invalid" : ""}`}>
            <Lock size={16} />
            <input type="password" autoComplete="new-password" placeholder="At least 6 characters" value={form.password} onChange={set("password")} />
          </div>
          {showErr("password") && <div className="auth-field-error">{errors.password}</div>}

          <label className="auth-label">Confirm password</label>
          <div className={`auth-input ${showErr("confirm") ? "invalid" : ""}`}>
            <Lock size={16} />
            <input type="password" autoComplete="new-password" placeholder="Re-enter your password" value={form.confirm} onChange={set("confirm")} />
          </div>
          {matchHint && <div className="auth-field-hint">{matchHint}</div>}
          {showErr("confirm") && form.confirm.length === 0 && <div className="auth-field-error">{errors.confirm}</div>}

          <button className="btn primary" type="submit" disabled={submitting}
            style={{ marginTop: 14, padding: "11px", fontSize: 14.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <UserPlus size={17} /> {submitting ? "Creating account…" : "Create account"}
          </button>
        </form>

        <div className="auth-hint">
          Already have an account? <Link to="/login" className="auth-link">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
