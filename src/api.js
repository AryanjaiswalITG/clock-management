// Thin fetch wrapper around the backend API.
// In dev, Vite proxies /api -> http://localhost:4000 (see vite.config.js).

const TOKEN_KEY = "nw_token";

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
    res = await fetch(`/api${path}`, {
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

export const api = {
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
  departments: () => request("/departments"),
  employees: () => request("/employees"),

  myAttendance: () => request("/attendance/me"),
  clockIn: () => request("/attendance/clock-in", { method: "POST" }),
  clockOut: () => request("/attendance/clock-out", { method: "POST" }),
  resetAttendance: () => request("/attendance/reset", { method: "POST" }),
  attendanceToday: () => request("/attendance/today"),

  leaves: () => request("/leaves"),
  applyLeave: (payload) => request("/leaves", { method: "POST", body: payload }),
  setLeaveStatus: (id, status) =>
    request(`/leaves/${id}`, { method: "PATCH", body: { status } }),
};
