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
  const [regularizations, setRegularizations] = useState([]);
  const [deletedEmployees, setDeletedEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [depts, emps, lvs, att, regs] = await Promise.all([
        api.departments(),
        api.employees(),
        api.leaves(),
        api.attendanceToday(),
        api.regularizations(),
      ]);
      setDepartments(depts);
      setEmployees(emps);
      setLeaves(lvs);
      setAttendanceToday(att);
      setRegularizations(regs);
      // Admin-only archive; non-admins get 403 — fall back to empty.
      setDeletedEmployees(await api.deletedEmployees().catch(() => []));
    } catch (e) {
      setError(e.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Admin: create one employee, then reload org data.
  const createEmployee = useCallback(async (payload) => {
    const emp = await api.createEmployee(payload);
    await refresh();
    return emp;
  }, [refresh]);

  // Admin: delete one or more employees (sequentially), then reload.
  const deleteEmployees = useCallback(async (ids) => {
    for (const id of ids) await api.deleteEmployee(id);
    await refresh();
  }, [refresh]);

  // Apply for a leave request, then reload so it shows up in the list.
  const applyLeave = useCallback(async (payload) => {
    const leave = await api.applyLeave(payload);
    await refresh();
    return leave;
  }, [refresh]);

  // Optimistic leave status change, persisted to the backend.
  const setLeaveStatus = useCallback(async (id, status) => {
    setLeaves((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
    try {
      await api.setLeaveStatus(id, status);
    } catch {
      refresh(); // roll back to server truth on failure
    }
  }, [refresh]);

  // Request an attendance regularization, then reload.
  const applyRegularization = useCallback(async (payload) => {
    const reg = await api.applyRegularization(payload);
    await refresh();
    return reg;
  }, [refresh]);

  // Approve/reject a regularization. Approving rewrites that day's attendance on
  // the backend, so reload to pick up the new numbers.
  const setRegularizationStatus = useCallback(async (id, status) => {
    await api.setRegularizationStatus(id, status);
    await refresh();
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
      departments, employees, leaves, attendanceToday, regularizations, deletedEmployees, loading, error,
      refresh, setLeaveStatus, applyLeave, applyRegularization, setRegularizationStatus, createEmployee, deleteEmployees,
      deptName, empById, empName, empAvatar, headcountByDept,
    };
  }, [departments, employees, leaves, attendanceToday, regularizations, deletedEmployees, loading, error, refresh, setLeaveStatus, applyLeave, applyRegularization, setRegularizationStatus, createEmployee, deleteEmployees]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used inside <DataProvider>");
  return ctx;
}
