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

  // Load all org data. `silent` skips the loading/error UI so the background
  // poller can refresh without flashing spinners or clobbering the screen.
  const loadAll = useCallback(async ({ silent = false } = {}) => {
    if (!silent) { setLoading(true); setError(null); }
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
      if (!silent) setError(e.message || "Failed to load data");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const refresh = useCallback(() => loadAll({ silent: false }), [loadAll]);

  useEffect(() => { refresh(); }, [refresh]);

  // Near-real-time sync: poll in the background every 15s and whenever the tab
  // regains focus, so admin changes (new employees, leave decisions, team moves)
  // appear without a manual refresh or re-login. Paused while the tab is hidden.
  useEffect(() => {
    const tick = () => { if (!document.hidden) loadAll({ silent: true }); };
    const iv = setInterval(tick, 15000);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(iv);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [loadAll]);

  // Admin: create one employee, then reload org data.
  const createEmployee = useCallback(async (payload) => {
    const emp = await api.createEmployee(payload);
    await refresh();
    return emp;
  }, [refresh]);

  // Admin: update an employee's org placement / status, then reload.
  const updateEmployee = useCallback(async (id, patch) => {
    const emp = await api.updateEmployee(id, patch);
    await refresh();
    return emp;
  }, [refresh]);

  // Admin: delete one or more employees (sequentially), then reload.
  const deleteEmployees = useCallback(async (ids) => {
    for (const id of ids) await api.deleteEmployee(id);
    await refresh();
  }, [refresh]);

  // Admin: create a department, then reload.
  const createDepartment = useCallback(async (name) => {
    const dept = await api.createDepartment(name);
    await refresh();
    return dept;
  }, [refresh]);

  // Apply for a leave request, then reload so it shows up in the list.
  const applyLeave = useCallback(async (payload) => {
    const leave = await api.applyLeave(payload);
    await refresh();
    return leave;
  }, [refresh]);

  // Optimistic leave status change (admin approve/reject), persisted to the
  // backend. `comment` is the admin's optional note shown to the employee.
  const setLeaveStatus = useCallback(async (id, status, comment) => {
    setLeaves((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
    try {
      await api.setLeaveStatus(id, status, comment);
    } catch {
      refresh(); // roll back to server truth on failure
    }
  }, [refresh]);

  // Employee cancels their own pending leave request, then reload.
  const cancelLeave = useCallback(async (id) => {
    await api.cancelLeave(id);
    await refresh();
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
      refresh, setLeaveStatus, cancelLeave, applyLeave, applyRegularization, setRegularizationStatus,
      createEmployee, updateEmployee, deleteEmployees, createDepartment,
      deptName, empById, empName, empAvatar, headcountByDept,
    };
  }, [departments, employees, leaves, attendanceToday, regularizations, deletedEmployees, loading, error, refresh, setLeaveStatus, cancelLeave, applyLeave, applyRegularization, setRegularizationStatus, createEmployee, updateEmployee, deleteEmployees, createDepartment]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used inside <DataProvider>");
  return ctx;
}
