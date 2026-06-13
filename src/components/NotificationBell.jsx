// Header notification bell + dropdown. Polls the per-user notification feed
// (every 15s and on tab focus) so admins see new joins/leave requests and
// employees see leave decisions / org changes without a manual refresh.
import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, UserPlus, Plane, Network, Building, CheckCheck } from "lucide-react";
import { api } from "../api";

const TYPE_ICON = {
  employee: UserPlus,
  leave: Plane,
  team: Network,
  company: Building,
};

// Compact relative time, e.g. "just now", "5m ago", "3h ago", "2d ago".
function ago(iso) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 45) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function NotificationBell() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const load = useCallback(async () => {
    try { setItems(await api.notifications()); } catch { /* keep previous on error */ }
  }, []);

  // Initial load + background poll (paused while the tab is hidden) + on focus.
  useEffect(() => {
    load();
    const tick = () => { if (!document.hidden) load(); };
    const iv = setInterval(tick, 15000);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(iv);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [load]);

  // Close the dropdown on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const unread = items.filter((n) => !n.read).length;

  async function markAll() {
    setItems((prev) => prev.map((n) => ({ ...n, read: true }))); // optimistic
    try { await api.markAllNotificationsRead(); } catch { load(); }
  }

  async function openItem(n) {
    if (n.read) return;
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    try { await api.markNotificationRead(n.id); } catch { load(); }
  }

  return (
    <div className="notif" ref={wrapRef}>
      <button
        className="notif-btn"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Bell size={18} />
        {unread > 0 && <span className="notif-badge">{unread > 9 ? "9+" : unread}</span>}
      </button>

      {open && (
        <div className="notif-panel" role="dialog" aria-label="Notifications">
          <div className="notif-head">
            <span className="notif-title">Notifications</span>
            {unread > 0 && (
              <button className="notif-markall" onClick={markAll}>
                <CheckCheck size={14} /> Mark all read
              </button>
            )}
          </div>

          <div className="notif-list">
            {items.length === 0 && (
              <div className="notif-empty">You're all caught up 🎉</div>
            )}
            {items.map((n) => {
              const Icon = TYPE_ICON[n.type] || Bell;
              return (
                <button
                  key={n.id}
                  className={`notif-item ${n.read ? "" : "unread"}`}
                  onClick={() => openItem(n)}
                >
                  <span className="notif-ico"><Icon size={15} /></span>
                  <span className="notif-body">
                    <span className="notif-msg">{n.message}</span>
                    <span className="notif-time">{ago(n.createdAt)}</span>
                  </span>
                  {!n.read && <span className="notif-dot" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
