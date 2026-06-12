// API layer. Two backends:
//  - Real Express server (local dev): fetch to "<base>/api", which Vite proxies
//    to localhost:4000 (see vite.config.js).
//  - In-browser mock (GitHub Pages, server-less): when VITE_USE_MOCK="true",
//    requests are served from localStorage instead (see src/mockApi.js).
import { createMockApi } from "./mockApi";

const TOKEN_KEY = "nw_token";

const API_PREFIX = `${import.meta.env.BASE_URL}api`.replace(/\/+/g, "/");

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

// Thrown on any non-2xx response; carries the HTTP status so callers can
// distinguish "wrong password" (401) from other failures.
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`${API_PREFIX}${path}`, {
      method,
      headers,
      credentials: "include", // send/receive the httpOnly session cookie
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    // Network error / server not running.
    throw new ApiError("Cannot reach the server. Is the backend running?", 0);
  }

  let data = null;
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); } catch { data = { error: text }; }
  }

  if (!res.ok) {
    throw new ApiError(data?.error || `Request failed (${res.status})`, res.status);
  }
  return data;
}

const realApi = {
  login: (email, password) =>
    request("/auth/login", { method: "POST", body: { email, password }, auth: false }),
  register: (payload) =>
    request("/auth/register", { method: "POST", body: payload, auth: false }),
  logout: () => request("/auth/logout", { method: "POST", auth: false }),
  demoAccount: () => request("/demo-account", { auth: false }),
  settings: () => request("/settings", { auth: false }),
  updateSettings: (payload) => request("/settings", { method: "PATCH", body: payload }),
  me: () => request("/me"),
  updateProfile: (payload) => request("/me", { method: "PATCH", body: payload }),
  deleteMe: () => request("/me", { method: "DELETE" }),
  departments: () => request("/departments"),
  employees: () => request("/employees"),
  deletedEmployees: () => request("/employees/deleted"),
  createEmployee: (payload) => request("/employees", { method: "POST", body: payload }),
  deleteEmployee: (id) => request(`/employees/${id}`, { method: "DELETE" }),

  myAttendance: () => request("/attendance/me"),
  clockIn: (location = "office") => request("/attendance/clock-in", { method: "POST", body: { location } }),
  clockOut: () => request("/attendance/clock-out", { method: "POST" }),
  resetAttendance: () => request("/attendance/reset", { method: "POST" }),
  attendanceToday: () => request("/attendance/today"),
  monthlyAttendance: ({ year, month } = {}) =>
    request(`/attendance/monthly?year=${year}&month=${month}`),
  monthlyTeam: ({ year, month } = {}) =>
    request(`/attendance/monthly/team?year=${year}&month=${month}`),

  leaves: () => request("/leaves"),
  applyLeave: (payload) => request("/leaves", { method: "POST", body: payload }),
  setLeaveStatus: (id, status) =>
    request(`/leaves/${id}`, { method: "PATCH", body: { status } }),

  regularizations: () => request("/regularizations"),
  applyRegularization: (payload) => request("/regularizations", { method: "POST", body: payload }),
  setRegularizationStatus: (id, status) =>
    request(`/regularizations/${id}`, { method: "PATCH", body: { status } }),
};

// Use the in-browser mock for the server-less (GitHub Pages) build.
export const api =
  import.meta.env.VITE_USE_MOCK === "true" ? createMockApi(ApiError) : realApi;
