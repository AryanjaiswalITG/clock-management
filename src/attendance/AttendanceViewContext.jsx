// Shares the My Attendance page's view state + monthly summary with the header,
// so the header can render the "My Attendance / Monthly Attendance" switch and
// its hover popup while the page owns the data and rendering.
import { createContext, useContext, useState, useMemo } from "react";

const AttendanceViewContext = createContext(null);

export function AttendanceViewProvider({ children }) {
  const [view, setView] = useState("daily");      // "daily" | "monthly"
  const [monthly, setMonthly] = useState(null);    // summary for the hover popup
  const [active, setActive] = useState(false);      // is the My Attendance page mounted?

  const value = useMemo(
    () => ({ view, setView, monthly, setMonthly, active, setActive }),
    [view, monthly, active]
  );
  return <AttendanceViewContext.Provider value={value}>{children}</AttendanceViewContext.Provider>;
}

export function useAttendanceView() {
  const ctx = useContext(AttendanceViewContext);
  if (!ctx) throw new Error("useAttendanceView must be used inside <AttendanceViewProvider>");
  return ctx;
}
