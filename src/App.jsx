import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { DataProvider } from "./data/DataContext";
import { AttendanceViewProvider } from "./attendance/AttendanceViewContext";
import Layout from "./layout/Layout";

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Employees from "./pages/Employees";
import Org from "./pages/Org";
import Attendance from "./pages/Attendance";
import Leave from "./pages/Leave";
import Payroll from "./pages/Payroll";
import MyAttendance from "./pages/MyAttendance";
import Team from "./pages/Team";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";

// Full-screen loader while we check the stored token.
function Splash() {
  return (
    <div className="auth-screen">
      <div style={{ color: "var(--ink-soft)" }}>Loading…</div>
    </div>
  );
}

// Redirects to /login if not authenticated.
function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Splash />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return children;
}

// For /login and /signup: if a valid session cookie already logged us in,
// skip the form and go straight to the dashboard.
function RedirectIfAuthed({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (user) return <Navigate to="/" replace />;
  return children;
}

// The signed-in app: sidebar + role-specific pages.
// Three roles: admin (org-wide), manager (own team), employee (just me).
function AppShell() {
  const { isAdmin, isManager } = useAuth();

  return (
    // Every role reads from the backend via DataProvider; the API scopes the
    // data to what each role may see (admin → all, manager → reports, me → self).
    <DataProvider>
      <AttendanceViewProvider>
        <Layout>
          <Routes>
            {isAdmin && (
              <>
                <Route path="/" element={<Dashboard />} />
                <Route path="/employees" element={<Employees />} />
                <Route path="/org" element={<Org />} />
                <Route path="/attendance" element={<Attendance />} />
                <Route path="/leave" element={<Leave />} />
                <Route path="/payroll" element={<Payroll />} />
              </>
            )}
            {isManager && (
              <>
                <Route path="/" element={<MyAttendance />} />
                <Route path="/team" element={<Team />} />
                <Route path="/attendance" element={<Attendance />} />
                <Route path="/leave" element={<Leave />} />
              </>
            )}
            {!isAdmin && !isManager && (
              <>
                <Route path="/" element={<MyAttendance />} />
                <Route path="/leave" element={<Leave />} />
              </>
            )}
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </AttendanceViewProvider>
    </DataProvider>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<RedirectIfAuthed><Login /></RedirectIfAuthed>} />
      <Route path="/signup" element={<RedirectIfAuthed><Signup /></RedirectIfAuthed>} />
      <Route path="/*" element={<RequireAuth><AppShell /></RequireAuth>} />
    </Routes>
  );
}
