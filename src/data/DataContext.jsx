// Loads the org-wide data the ADMIN pages need (employees, departments, leaves,
// today's attendance) from the backend once, and exposes lookup helpers +
// mutators. Replaces the old static src/data/store.js for admin views.
import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { api } from "../api";

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [attendanceToday, setAttendanceToday] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [depts, emps, lvs, att] = await Promise.all([
        api.departments(),
        api.employees(),
        api.leaves(),
        api.attendanceToday(),
      ]);
      setDepartments(depts);
      setEmployees(emps);
      setLeaves(lvs);
      setAttendanceToday(att);
    } catch (e) {
      setError(e.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Optimistic leave status change, persisted to the backend.
  const setLeaveStatus = useCallback(async (id, status) => {
    setLeaves((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
    try {
      await api.setLeaveStatus(id, status);
    } catch {
      refresh(); // roll back to server truth on failure
    }
  }, [refresh]);

  const value = useMemo(() => {
    const deptName = (id) => departments.find((d) => d.id === id)?.name ?? "—";
    const empById = (id) => employees.find((e) => e.id === id);
    const empName = (id) => empById(id)?.name ?? "—";
    const empAvatar = (id) => empById(id)?.avatar ?? "?";
    const headcountByDept = departments.map((d) => ({
      name: d.name,
      value: employees.filter((e) => e.deptId === d.id).length,
    }));
    return {
      departments, employees, leaves, attendanceToday, loading, error,
      refresh, setLeaveStatus,
      deptName, empById, empName, empAvatar, headcountByDept,
    };
  }, [departments, employees, leaves, attendanceToday, loading, error, refresh, setLeaveStatus]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used inside <DataProvider>");
  return ctx;
}
