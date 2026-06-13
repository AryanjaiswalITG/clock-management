// Org-level settings: company name + attendance policy (weekend days, holidays).
// Loaded from the public /api/settings endpoint so the brand shows on the login
// screen too, and kept in sync app-wide when edited.
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "../api";
import { DEFAULT_WEEKEND_DAYS } from "../../shared/attendance.js";

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [companyName, setCompanyName] = useState("Northwind");
  const [weekendDays, setWeekendDays] = useState(DEFAULT_WEEKEND_DAYS);
  const [holidays, setHolidays] = useState([]);

  const apply = useCallback((s) => {
    if (s?.companyName !== undefined) setCompanyName(s.companyName);
    if (Array.isArray(s?.weekendDays)) setWeekendDays(s.weekendDays);
    if (Array.isArray(s?.holidays)) setHolidays(s.holidays);
    return s;
  }, []);

  // Load org settings on mount, and again whenever the tab regains focus, so an
  // admin's change to the company name / attendance policy propagates to every
  // signed-in user's open session without needing a full reload.
  useEffect(() => {
    let cancelled = false;
    const fetchSettings = () =>
      api.settings().then((s) => { if (!cancelled) apply(s); }).catch(() => {});
    fetchSettings();
    // Poll in the background (and on focus) so an admin's company/policy change
    // reaches every signed-in user within a few seconds, no reload needed.
    const tick = () => { if (!document.hidden) fetchSettings(); };
    const iv = setInterval(tick, 30000);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      cancelled = true;
      clearInterval(iv);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [apply]);

  // Persist a new company name and update the brand everywhere.
  const updateCompany = useCallback(async (name) => {
    return apply(await api.updateSettings({ companyName: name }));
  }, [apply]);

  // Persist the attendance policy (weekend days and/or holiday list).
  const updatePolicy = useCallback(async (patch) => {
    return apply(await api.updateSettings(patch));
  }, [apply]);

  return (
    <SettingsContext.Provider value={{ companyName, weekendDays, holidays, updateCompany, updatePolicy }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside <SettingsProvider>");
  return ctx;
}
