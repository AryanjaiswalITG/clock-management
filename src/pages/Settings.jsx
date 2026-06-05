import { useState, useRef } from "react";
import { Palette, Sun, Moon, Image as ImageIcon, Building, Check, RotateCcw, Trash2, Droplet } from "lucide-react";
import { useTheme, DEFAULT_ACCENT } from "../theme/ThemeContext";
import { useSettings } from "../settings/SettingsContext";

const MAX_BG_BYTES = 2 * 1024 * 1024; // keep under the localStorage quota

export default function Settings() {
  const { mode, accent, bgColor, bgImage, setMode, setAccent, setBgColor, setBgImage, resetTheme, accents } = useTheme();
  const { companyName, updateCompany } = useSettings();

  const [company, setCompany] = useState(companyName);
  const [flash, setFlash] = useState(null);   // success/info toast
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  // Snapshot of everything when the page mounted, for "Cancel".
  const snapshot = useRef({ mode, accent, bgColor, bgImage, company: companyName });

  function toast(msg) {
    setFlash(msg);
    setTimeout(() => setFlash(null), 2500);
  }

  function onBgImage(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please choose an image file"); return; }
    if (file.size > MAX_BG_BYTES) { setError("Image is too large (max 2 MB)"); return; }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => setBgImage(reader.result); // live preview immediately
    reader.onerror = () => setError("Could not read that file");
    reader.readAsDataURL(file);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      if (company.trim() && company.trim() !== companyName) {
        await updateCompany(company.trim());
      }
      // Theme prefs are already applied + persisted live by ThemeContext.
      snapshot.current = { mode, accent, bgColor, bgImage, company: company.trim() || companyName };
      toast("Settings saved");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    const s = snapshot.current;
    setMode(s.mode);
    setAccent(s.accent);
    setBgColor(s.bgColor);
    setBgImage(s.bgImage);
    setCompany(s.company);
    setError(null);
    toast("Changes reverted");
  }

  function reset() {
    resetTheme();
    setError(null);
    toast("Reset to default appearance");
  }

  return (
    <>
      {flash && <div className="toast"><Check size={16} /> {flash}</div>}

      <div className="section-head"><h2>Settings</h2></div>

      {error && (
        <div className="card" style={{ marginBottom: 18, borderColor: "var(--rose)", color: "var(--rose)" }}>{error}</div>
      )}

      <div className="grid cols-2" style={{ alignItems: "start" }}>
        {/* Theme + colours */}
        <div className="card">
          <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}><Palette size={17} /> Theme & colours</div>
          <div className="card-sub">Switch mode and pick your accent — applied instantly.</div>

          <div className="field">
            <label className="field-label">Theme mode</label>
            <div className="mode-seg">
              <button className={mode === "light" ? "active" : ""} onClick={() => setMode("light")}><Sun size={15} /> Light</button>
              <button className={mode === "dark" ? "active" : ""} onClick={() => setMode("dark")}><Moon size={15} /> Dark</button>
            </div>
          </div>

          <div className="field">
            <label className="field-label">Accent colour</label>
            <div className="swatches">
              {accents.map((a) => (
                <button key={a.color} className={`swatch ${accent === a.color ? "active" : ""}`}
                  style={{ background: a.color }} title={a.name} aria-label={a.name} onClick={() => setAccent(a.color)}>
                  {accent === a.color && <Check size={16} color="#fff" />}
                </button>
              ))}
              <label className="swatch swatch-custom" title="Custom colour" style={{ background: accent }}>
                <Droplet size={15} color="#fff" />
                <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} hidden />
              </label>
            </div>
          </div>
        </div>

        {/* Background */}
        <div className="card">
          <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}><ImageIcon size={17} /> Background</div>
          <div className="card-sub">Set a custom background colour or upload a wallpaper.</div>

          <div className="field">
            <label className="field-label">Background colour</label>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <label className="swatch swatch-custom" style={{ background: bgColor || "var(--bg)", borderColor: "var(--line)" }} title="Pick background colour">
                <Droplet size={15} color={bgColor ? "#fff" : "var(--ink-soft)"} />
                <input type="color" value={bgColor || "#f4f6f5"} onChange={(e) => setBgColor(e.target.value)} hidden />
              </label>
              <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>{bgColor || "Theme default"}</span>
              {bgColor && <button className="btn ghost sm" onClick={() => setBgColor(null)}>Clear</button>}
            </div>
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label className="field-label">Background image</label>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div className="bg-preview" style={bgImage ? { backgroundImage: `url("${bgImage}")` } : undefined}>
                {!bgImage && <span style={{ fontSize: 11.5, color: "var(--ink-soft)" }}>No image</span>}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <label className="btn ghost sm" style={{ cursor: "pointer" }}>
                  <ImageIcon size={14} style={{ marginRight: 6, verticalAlign: "-2px" }} /> {bgImage ? "Change" : "Upload"}
                  <input type="file" accept="image/*" onChange={onBgImage} hidden />
                </label>
                {bgImage && <button className="btn ghost sm" onClick={() => setBgImage(null)}><Trash2 size={14} style={{ marginRight: 6, verticalAlign: "-2px" }} /> Remove</button>}
              </div>
            </div>
            <div className="field-hint">PNG/JPG up to 2 MB. Shows behind the glassy UI.</div>
          </div>
        </div>
      </div>

      {/* Company */}
      <div className="card" style={{ marginTop: 18 }}>
        <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}><Building size={17} /> Company information</div>
        <div className="card-sub">Shown as the brand in the sidebar, header and login screen.</div>
        <div className="field" style={{ maxWidth: 380, marginBottom: 0 }}>
          <label className="field-label">Company name</label>
          <input className="field-control" value={company} onChange={(e) => setCompany(e.target.value)} maxLength={40} placeholder="e.g. Northwind" />
        </div>
      </div>

      {/* Actions */}
      <div className="settings-actions">
        <button className="btn primary" onClick={save} disabled={busy}>
          <Check size={15} style={{ marginRight: 6, verticalAlign: "-2px" }} /> {busy ? "Saving…" : "Save"}
        </button>
        <button className="btn ghost" onClick={cancel} disabled={busy}>Cancel</button>
        <button className="btn ghost" onClick={reset} disabled={busy} style={{ marginLeft: "auto" }}>
          <RotateCcw size={14} style={{ marginRight: 6, verticalAlign: "-2px" }} /> Reset to default
        </button>
      </div>
    </>
  );
}
