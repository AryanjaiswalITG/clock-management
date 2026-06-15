import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { lazy, Suspense } from "react";
import { useAuth } from "./auth/AuthContext";
import { DataProvider } from "./data/DataContext";
import { AttendanceViewProvider } from "./attendance/AttendanceViewContext";
import Layout from "./layout/Layout";

// Login/Signup are eager (first paint). The signed-in pages are code-split so
// the initial bundle stays small and heavy pages (charts) load on demand.
import Login from "./pages/Login";
import Signup from "./pages/Signup";
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Employees = lazy(() => import("./pages/Employees"));
const Org = lazy(() => import("./pages/Org"));
const Attendance = lazy(() => import("./pages/Attendance"));
const Leave = lazy(() => import("./pages/Leave"));
const Payroll = lazy(() => import("./pages/Payroll"));
const MyAttendance = lazy(() => import("./pages/MyAttendance"));
const Team = lazy(() => import("./pages/Team"));
const Profile = lazy(() => import("./pages/Profile"));
const Settings = lazy(() => import("./pages/Settings"));

// Full-screen loader (animated spinner) while we check the stored token or a
// code-split page is loading.
function Splash() {
  return (
    <div className="auth-screen">
      <div className="splash">
        <div className="spinner" aria-hidden="true" />
        <div style={{ color: "var(--ink-soft)", fontSize: 14 }}>Loading…</div>
      </div>
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
          <Suspense fallback={<Splash />}>
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
          </Suspense>
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
