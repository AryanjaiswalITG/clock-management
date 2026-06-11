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

  useEffect(() => {
    api.settings().then((s) => {
      setCompanyName(s.companyName);
      if (Array.isArray(s.weekendDays)) setWeekendDays(s.weekendDays);
      if (Array.isArray(s.holidays)) setHolidays(s.holidays);
    }).catch(() => {});
  }, []);

  const apply = (s) => {
    setCompanyName(s.companyName);
    if (Array.isArray(s.weekendDays)) setWeekendDays(s.weekendDays);
    if (Array.isArray(s.holidays)) setHolidays(s.holidays);
    return s;
  };

  // Persist a new company name and update the brand everywhere.
  const updateCompany = useCallback(async (name) => {
    return apply(await api.updateSettings({ companyName: name }));
  }, []);

  // Persist the attendance policy (weekend days and/or holiday list).
  const updatePolicy = useCallback(async (patch) => {
    return apply(await api.updateSettings(patch));
  }, []);

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
