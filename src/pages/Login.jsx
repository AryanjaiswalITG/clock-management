import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { LogIn, Lock, Mail, AlertCircle, X } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useSettings } from "../settings/SettingsContext";
import { api } from "../api";

export default function Login() {
  const { login } = useAuth();
  const { companyName } = useSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [popup, setPopup] = useState(null); // { title, message } -> retry modal
  const [demo, setDemo] = useState(null);    // demo account hint, fetched live

  // Pull the current demo account from the backend so the hint never goes stale.
  useEffect(() => {
    api.demoAccount().then(setDemo).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true }); // success -> dashboard
    } catch (err) {
      // Wrong credentials (or any failure) -> show the retry popup.
      setPopup({
        title: err.status === 401 ? "Login failed" : "Something went wrong",
        message:
          err.status === 401
            ? "The email or password you entered is incorrect. Please try again."
            : err.message,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="brand" style={{ justifyContent: "center", paddingBottom: 8 }}>
          <div className="brand-mark">{(companyName[0] || "N").toUpperCase()}</div>
          <div className="brand-name" style={{ color: "var(--ink)" }}>{companyName}</div>
        </div>
        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-sub">Sign in to your People HR account</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <label className="auth-label">Email</label>
          <div className="auth-input">
            <Mail size={16} />
            <input
              type="email"
              autoComplete="username"
              placeholder="you@northwind.co"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <label className="auth-label">Password</label>
          <div className="auth-input">
            <Lock size={16} />
            <input
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button className="btn primary" type="submit" disabled={submitting}
            style={{ marginTop: 8, padding: "11px", fontSize: 14.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <LogIn size={17} /> {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="auth-hint">
          New here? <Link to="/signup" className="auth-link">Create an account</Link>
        </div>

        {demo && (
          <div className="auth-hint" style={{ borderTop: "none", paddingTop: 4 }}>
            Demo account<br />
            Email: <b>{demo.email}</b> · Password: <b>{demo.password}</b>
            <div style={{ marginTop: 8 }}>
              <button type="button" className="btn ghost sm"
                onClick={() => { setEmail(demo.email); setPassword(demo.password); }}>
                Fill demo credentials
              </button>
            </div>
          </div>
        )}
      </div>

      {popup && (
        <div className="modal-overlay" onClick={() => setPopup(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setPopup(null)} aria-label="Close"><X size={18} /></button>
            <div className="modal-icon"><AlertCircle size={26} color="var(--rose)" /></div>
            <div className="modal-title">{popup.title}</div>
            <div className="modal-message">{popup.message}</div>
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setPopup(null)}>Cancel</button>
              <button className="btn primary" onClick={() => { setPopup(null); setPassword(""); }} autoFocus>
                Retry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
