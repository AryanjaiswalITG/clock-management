// JWT sign/verify + Express middleware for protecting routes.
import jwt from "jsonwebtoken";

// In a real deployment this comes from an env var / secret manager.
const JWT_SECRET = process.env.JWT_SECRET || "northwind-dev-secret-change-me";
const TOKEN_TTL = "8h";
export const COOKIE_NAME = "nw_token";
export const COOKIE_MAX_AGE = 8 * 60 * 60 * 1000; // 8h, matches the token TTL

export function signToken(employee) {
  return jwt.sign(
    { sub: employee.id, role: employee.role, name: employee.name },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL }
  );
}

// Set / clear the httpOnly session cookie.
// secure:false because the demo runs over http on localhost — set true behind HTTPS.
export function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
}

export function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

// Accepts the token from the httpOnly cookie (primary) or an Authorization
// header (fallback), verifies it, and attaches req.auth.
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const headerToken = header.startsWith("Bearer ") ? header.slice(7) : null;
  const token = req.cookies?.[COOKIE_NAME] || headerToken;
  if (!token) return res.status(401).json({ error: "Not authenticated" });
  try {
    req.auth = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Session expired, please log in again" });
  }
}

// Use after requireAuth to restrict a route to admins.
export function requireAdmin(req, res, next) {
  if (req.auth?.role !== "admin") {
    return res.status(403).json({ error: "Admins only" });
  }
  next();
}
