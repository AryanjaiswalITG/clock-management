// Appearance preferences, persisted in localStorage and applied to the document:
//  - mode      : light | dark   -> data-theme attribute on <html>
//  - accent    : hex colour      -> --teal CSS variable (all soft tints derive from it)
//  - bgColor   : hex | null      -> overrides the page --bg
//  - bgImage   : dataURL | null  -> wallpaper on <body>
import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";

const MODE_KEY = "nw_theme_mode";
const ACCENT_KEY = "nw_theme_accent";
const BGCOLOR_KEY = "nw_bg_color";
const BGIMAGE_KEY = "nw_bg_image";

// Selectable accent colours.
export const ACCENTS = [
  { name: "Teal", color: "#0f6e63" },
  { name: "Blue", color: "#2563eb" },
  { name: "Violet", color: "#7c3aed" },
  { name: "Rose", color: "#e11d48" },
  { name: "Amber", color: "#d97706" },
  { name: "Green", color: "#16a34a" },
];

export const DEFAULT_MODE = "light";
export const DEFAULT_ACCENT = ACCENTS[0].color;

const ThemeContext = createContext(null);

function initialMode() {
  const saved = localStorage.getItem(MODE_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
function initialAccent() {
  return localStorage.getItem(ACCENT_KEY) || DEFAULT_ACCENT;
}
function initialBgColor() {
  return localStorage.getItem(BGCOLOR_KEY) || null;
}
function initialBgImage() {
  return localStorage.getItem(BGIMAGE_KEY) || null;
}

export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState(initialMode);
  const [accent, setAccentState] = useState(initialAccent);
  const [bgColor, setBgColorState] = useState(initialBgColor);
  const [bgImage, setBgImageState] = useState(initialBgImage);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", mode);
    localStorage.setItem(MODE_KEY, mode);
  }, [mode]);

  useEffect(() => {
    document.documentElement.style.setProperty("--teal", accent);
    localStorage.setItem(ACCENT_KEY, accent);
  }, [accent]);

  // Custom background colour overrides the theme's --bg (inline wins over CSS).
  useEffect(() => {
    if (bgColor) {
      document.documentElement.style.setProperty("--bg", bgColor);
      localStorage.setItem(BGCOLOR_KEY, bgColor);
    } else {
      document.documentElement.style.removeProperty("--bg");
      localStorage.removeItem(BGCOLOR_KEY);
    }
  }, [bgColor]);

  // Background image wallpaper on <body> (sits behind the translucent UI).
  useEffect(() => {
    const b = document.body;
    if (bgImage) {
      b.style.backgroundImage = `url("${bgImage}")`;
      b.style.backgroundSize = "cover";
      b.style.backgroundPosition = "center";
      b.style.backgroundAttachment = "fixed";
      b.classList.add("has-bg"); // enables the frosted-card treatment
      try { localStorage.setItem(BGIMAGE_KEY, bgImage); } catch { /* quota — keep for session only */ }
    } else {
      b.style.backgroundImage = "";
      b.style.backgroundSize = "";
      b.style.backgroundPosition = "";
      b.style.backgroundAttachment = "";
      b.classList.remove("has-bg");
      localStorage.removeItem(BGIMAGE_KEY);
    }
  }, [bgImage]);

  const setMode = useCallback((m) => setModeState(m), []);
  const toggleMode = useCallback(() => setModeState((m) => (m === "dark" ? "light" : "dark")), []);
  const setAccent = useCallback((c) => setAccentState(c), []);
  const setBgColor = useCallback((c) => setBgColorState(c || null), []);
  const setBgImage = useCallback((img) => setBgImageState(img || null), []);

  // Restore everything to the out-of-the-box appearance.
  const resetTheme = useCallback(() => {
    setModeState(DEFAULT_MODE);
    setAccentState(DEFAULT_ACCENT);
    setBgColorState(null);
    setBgImageState(null);
  }, []);

  const value = useMemo(
    () => ({
      mode, accent, bgColor, bgImage,
      setMode, toggleMode, setAccent, setBgColor, setBgImage, resetTheme,
      accents: ACCENTS,
    }),
    [mode, accent, bgColor, bgImage, setMode, toggleMode, setAccent, setBgColor, setBgImage, resetTheme]
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
