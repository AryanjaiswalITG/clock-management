// Org-level settings (currently just the company name). Loaded from the public
// /api/settings endpoint so the brand shows on the login screen too, and kept
// in sync app-wide when edited from the profile.
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "../api";

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [companyName, setCompanyName] = useState("Northwind");

  useEffect(() => {
    api.settings().then((s) => setCompanyName(s.companyName)).catch(() => {});
  }, []);

  // Persist a new company name and update the brand everywhere.
  const updateCompany = useCallback(async (name) => {
    const s = await api.updateSettings({ companyName: name });
    setCompanyName(s.companyName);
    return s;
  }, []);

  return (
    <SettingsContext.Provider value={{ companyName, updateCompany }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside <SettingsProvider>");
  return ctx;
}
