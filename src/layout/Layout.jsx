import { useState, useEffect } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, CalendarClock, CalendarRange, Plane, Wallet, Network, Search, Bell, User, LogOut, Sun, Moon, Settings as SettingsIcon, Mail, Briefcase, Menu, X } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useTheme } from "../theme/ThemeContext";
import { useSettings } from "../settings/SettingsContext";
import { useAttendanceView } from "../attendance/AttendanceViewContext";
import { SUMMARY_ITEMS, styleFor } from "../components/attendanceStatus";
import { formatDuration } from "../utils/time";
import Avatar from "../components/Avatar";

const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

// The "My Attendance / Monthly Attendance" switch + hover summary, rendered in
// the header only while the employee's My Attendance page is mounted.
function AttendanceSwitch() {
  const { view, setView, monthly, active } = useAttendanceView();
  if (!active) return null;

  const monthLabel = monthly ? `${MONTHS[monthly.month - 1]} ${monthly.year}` : "";
  const totalWorked = monthly ? monthly.days.reduce((s, d) => s + (d.workedSec || 0), 0) : 0;

  return (
    <div className="view-switch" role="tablist" aria-label="Attendance view">
      <button type="button" role="tab" aria-selected={view === "daily"}
        className={`view-tab ${view === "daily" ? "active" : ""}`} onClick={() => setView("daily")}>
        <CalendarClock size={15} />
        <span className="vt-full">Daily</span><span className="vt-short">Daily</span>
      </button>

      <div className="attn-menu">
        <button type="button" role="tab" aria-selected={view === "monthly"} aria-haspopup="dialog"
          className={`view-tab ${view === "monthly" ? "active" : ""}`} onClick={() => setView("monthly")}>
          <CalendarRange size={15} />
          <span className="vt-full">Monthly</span><span className="vt-short">Monthly</span>
        </button>

        <div className="attn-popup" role="dialog" aria-label="Monthly attendance summary">
          <div className="attn-popup-head">
            <div className="pd-name">Monthly Attendance</div>
            <div className="pd-role">{monthLabel || "This month"}</div>
          </div>
          {monthly ? (
            <>
              <div className="attn-popup-grid">
                {SUMMARY_ITEMS.map(({ key, status }) => {
                  const st = styleFor(status);
                  return (
                    <div key={key} className="attn-popup-stat">
                      <span className="attn-dot" style={{ background: st.color }} />
                      <span className="n">{monthly.totals[key]}</span>
                      <span className="l">{st.label}</span>
                    </div>
                  );
                })}
              </div>
              <div className="profile-dropdown-sep" />
              <div className="attn-popup-foot"><span>Worked this month</span><strong>{formatDuration(totalWorked)}</strong></div>
              <div className="attn-popup-foot"><span>Working days</span><strong>{monthly.totals.workingDays}</strong></div>
            </>
          ) : (
            <div className="attn-popup-empty">Loading summary…</div>
          )}
        </div>
      </div>
    </div>
  );
}

// Navigation differs by role.
const ADMIN_NAV = [
  { group: "Workspace", items: [
    { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/employees", label: "Employees", icon: Users },
    { to: "/org", label: "Org Chart", icon: Network },
  ]},
  { group: "Time", items: [
    { to: "/attendance", label: "Attendance", icon: CalendarClock },
    { to: "/leave", label: "Leave", icon: Plane },
  ]},
  { group: "Finance", items: [
    { to: "/payroll", label: "Payroll", icon: Wallet },
  ]},
  { group: "Account", items: [
    { to: "/profile", label: "My Profile", icon: User },
    { to: "/settings", label: "Settings", icon: SettingsIcon },
  ]},
];

const EMPLOYEE_NAV = [
  { group: "Me", items: [
    { to: "/", label: "My Attendance", icon: CalendarClock, end: true },
    { to: "/profile", label: "My Profile", icon: User },
    { to: "/settings", label: "Settings", icon: SettingsIcon },
  ]},
];

const TITLES = {
  "/": "Dashboard", "/employees": "Employees", "/org": "Org Chart",
  "/attendance": "Attendance", "/leave": "Leave Management", "/payroll": "Payroll",
  "/profile": "My Profile", "/settings": "Settings",
};

export default function Layout({ children }) {
  const { pathname } = useLocation();
  const { user, isAdmin, logout } = useAuth();
  const { mode, toggleMode } = useTheme();
  const { companyName } = useSettings();
  const { active: switchActive } = useAttendanceView();
  const nav = isAdmin ? ADMIN_NAV : EMPLOYEE_NAV;

  // Make the floating header a touch more solid once the page is scrolled.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // On small screens the sidebar collapses into a slide-out drawer.
  const [navOpen, setNavOpen] = useState(false);
  // Close the drawer whenever the route changes (e.g. after tapping a nav link).
  useEffect(() => { setNavOpen(false); }, [pathname]);
  // Lock body scroll while the drawer is open so the page behind doesn't move.
  useEffect(() => {
    document.body.style.overflow = navOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [navOpen]);

  // Employees see "My Attendance" at "/", admins see "Dashboard".
  const title = pathname === "/" && !isAdmin ? "My Attendance" : (TITLES[pathname] || companyName);

  return (
    <div className="app">
      {/* Dimmed backdrop behind the mobile drawer — tap to close. */}
      {navOpen && <div className="sidebar-overlay" onClick={() => setNavOpen(false)} />}

      <aside className={`sidebar ${navOpen ? "open" : ""}`}>
        {/* Ambient liquid blobs that drift behind the menu — always animating. */}
        <div className="sidebar-fx" aria-hidden="true" />
        <div className="brand">
          <div className="brand-mark">{(companyName[0] || "N").toUpperCase()}</div>
          <div className="brand-name">{companyName}</div>
          <button className="drawer-close" onClick={() => setNavOpen(false)} aria-label="Close menu">
            <X size={20} />
          </button>
        </div>
        {nav.map((g) => (
          <div key={g.group}>
            <div className="nav-group-label">{g.group}</div>
            {g.items.map((it) => (
              <NavLink key={it.to} to={it.to} end={it.end}
                className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
                <it.icon size={18} /> {it.label}
              </NavLink>
            ))}
          </div>
        ))}
        <div className="sidebar-foot">
          <button className="nav-item" style={{ width: "100%", border: "none", background: "none", cursor: "pointer" }} onClick={logout}>
            <LogOut size={18} /> Sign out
          </button>
          <div style={{ padding: "10px 12px 0" }}>People HR Suite · v0.2</div>
        </div>
      </aside>

      <div className="main">
        <header className={`topbar ${scrolled ? "scrolled" : ""}`}>
          <div className={`topbar-left ${switchActive ? "has-switch" : ""}`}>
            <button className="menu-btn" onClick={() => setNavOpen(true)} aria-label="Open menu">
              <Menu size={22} />
            </button>
            <h1>{title}</h1>
            <AttendanceSwitch />
          </div>
          <div className="topbar-right">
            <div className="search">
              <Search size={16} />
              <input placeholder="Search people, requests…" />
            </div>
            <button className="theme-toggle" onClick={toggleMode} title={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"} aria-label="Toggle theme">
              {mode === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <Bell size={20} color="var(--ink-soft)" />

            {/* Hover the avatar to slide open a details card */}
            <div className="profile-menu">
              <div className="profile-trigger">
                <div style={{ textAlign: "right", lineHeight: 1.2 }} className="profile-trigger-text">
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>{user?.name}</div>
                  <div style={{ fontSize: 11.5, color: "var(--ink-soft)", textTransform: "capitalize" }}>{user?.role}</div>
                </div>
                <Avatar src={user?.avatarUrl} initials={user?.avatar || "?"} className="avatar" />
              </div>

              <div className="profile-dropdown">
                <div className="profile-dropdown-head">
                  <Avatar src={user?.avatarUrl} initials={user?.avatar || "?"} className="emp-avatar" style={{ width: 46, height: 46, fontSize: 16 }} />
                  <div style={{ minWidth: 0 }}>
                    <div className="pd-name">{user?.name}</div>
                    <div className="pd-role" style={{ textTransform: "capitalize" }}>{user?.role}</div>
                  </div>
                </div>
                <div className="profile-dropdown-row"><Mail size={14} /> <span className="pd-ellipsis">{user?.email}</span></div>
                <div className="profile-dropdown-row"><Briefcase size={14} /> <span className="pd-ellipsis">{user?.designation}</span></div>
                <div className="profile-dropdown-sep" />
                <Link to="/profile" className="profile-dropdown-link"><User size={15} /> My Profile</Link>
                <Link to="/settings" className="profile-dropdown-link"><SettingsIcon size={15} /> Settings</Link>
                <button className="profile-dropdown-link danger" onClick={logout}><LogOut size={15} /> Sign out</button>
              </div>
            </div>
          </div>
        </header>
        <main className="content fade-in" key={pathname}>{children}</main>
      </div>
    </div>
  );
}
