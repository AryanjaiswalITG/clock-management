import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Mail, Building2, Building, CalendarDays, BadgeCheck, Clock, Shield, Pencil, Check, X, Lock, Briefcase, User, Palette, Camera, Trash2, ChevronRight } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import { useSettings } from "../settings/SettingsContext";
import Avatar from "../components/Avatar";
import Badge from "../components/Badge";

const MAX_PHOTO_BYTES = 3.5 * 1024 * 1024;

// One read-only detail row.
function ViewRow({ icon: Icon, label, value, locked }) {
  return (
    <div className="row-between" style={{ padding: "14px 0", borderBottom: "1px solid var(--line)" }}>
      <span style={{ fontSize: 14, color: "var(--ink-soft)", display: "flex", alignItems: "center", gap: 10 }}>
        <Icon size={16} /> {label}
      </span>
      <span style={{ fontSize: 14, fontWeight: 500, display: "flex", alignItems: "center", gap: 8 }}>
        {value}{locked && <Lock size={13} color="var(--ink-soft)" />}
      </span>
    </div>
  );
}

export default function Profile() {
  const { user, updateUser, logout } = useAuth();
  const { companyName, updateCompany } = useSettings();
  const [depts, setDepts] = useState([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [flash, setFlash] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState(null);

  function showFlash() {
    setFlash(true);
    setTimeout(() => setFlash(false), 2500);
  }

  // Read an image file, validate it, store it as a data URL on the profile.
  function onPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the same file be picked again later
    if (!file) return;
    if (!file.type.startsWith("image/")) { setPhotoError("Please choose an image file"); return; }
    if (file.size > MAX_PHOTO_BYTES) { setPhotoError("Image is too large (max 3.5 MB)"); return; }
    setPhotoError(null);
    setPhotoBusy(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const updated = await api.updateProfile({ avatarUrl: reader.result });
        updateUser(updated);
        showFlash();
      } catch (err) {
        setPhotoError(err.message);
      } finally {
        setPhotoBusy(false);
      }
    };
    reader.onerror = () => { setPhotoError("Could not read that file"); setPhotoBusy(false); };
    reader.readAsDataURL(file);
  }

  async function removePhoto() {
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      const updated = await api.updateProfile({ avatarUrl: null });
      updateUser(updated);
    } catch (err) {
      setPhotoError(err.message);
    } finally {
      setPhotoBusy(false);
    }
  }

  useEffect(() => {
    api.departments().then(setDepts).catch(() => {});
  }, []);

  const deptName = useMemo(
    () => depts.find((d) => d.id === user?.deptId)?.name ?? "—",
    [depts, user]
  );

  if (!user) return null;
  const joined = new Date(user.joinDate).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });

  function startEdit() {
    setForm({
      name: user.name,
      designation: user.designation,
      email: user.email,
      deptId: user.deptId,
      targetHours: user.targetHours,
      companyName,
    });
    setError(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setForm(null);
    setError(null);
  }

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const updated = await api.updateProfile({
        name: form.name,
        designation: form.designation,
        email: form.email,
        deptId: Number(form.deptId),
        targetHours: Number(form.targetHours),
      });
      updateUser(updated);     // refresh sidebar/topbar + everywhere
      // Company name is an org-level setting — save it if it changed.
      if (form.companyName.trim() !== companyName) {
        await updateCompany(form.companyName.trim());
      }
      setEditing(false);
      setForm(null);
      setFlash(true);
      setTimeout(() => setFlash(false), 2500);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {flash && (
        <div className="toast">
          <Check size={16} /> Profile updated
        </div>
      )}

      <div className="section-head">
        <h2>My Profile</h2>
        {!editing && (
          <button className="btn primary" onClick={startEdit}>
            <Pencil size={15} style={{ marginRight: 7, verticalAlign: "-2px" }} /> Edit profile
          </button>
        )}
      </div>

      {/* Hero banner */}
      <div className="profile-hero card" style={{ marginBottom: 18 }}>
        <div className="avatar-edit">
          <Avatar src={user.avatarUrl} initials={user.avatar} className="emp-avatar profile-avatar" />
          <label className="avatar-cam" title="Change photo">
            <Camera size={15} />
            <input type="file" accept="image/*" onChange={onPhoto} hidden disabled={photoBusy} />
          </label>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 600 }}>{user.name}</div>
          <div className="emp-meta" style={{ fontSize: 14, marginTop: 2 }}>{user.designation}</div>
          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span className="badge teal">{deptName}</span>
            <span className="badge gray" style={{ textTransform: "capitalize" }}>{user.role}</span>
            <Badge status={user.status} />
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <label className="btn ghost sm" style={{ cursor: photoBusy ? "default" : "pointer" }}>
              <Camera size={14} style={{ marginRight: 6, verticalAlign: "-2px" }} />
              {photoBusy ? "Uploading…" : user.avatarUrl ? "Change photo" : "Upload photo"}
              <input type="file" accept="image/*" onChange={onPhoto} hidden disabled={photoBusy} />
            </label>
            {user.avatarUrl && (
              <button className="btn ghost sm" onClick={removePhoto} disabled={photoBusy}>
                <Trash2 size={14} style={{ marginRight: 6, verticalAlign: "-2px" }} /> Remove
              </button>
            )}
            {photoError && <span style={{ fontSize: 12.5, color: "var(--rose)" }}>{photoError}</span>}
          </div>
        </div>
      </div>

      {error && (
        <div className="card" style={{ marginBottom: 18, borderColor: "var(--rose)", color: "var(--rose)", display: "flex", alignItems: "center", gap: 8 }}>
          <X size={16} /> {error}
        </div>
      )}

      {editing ? (
        /* ---- EDIT MODE ---- */
        <form className="card" onSubmit={save}>
          <div className="card-title">Edit details</div>
          <div className="card-sub">Update your information. Role and joining date are fixed.</div>

          <div className="field">
            <label className="field-label">Company name</label>
            <input className="field-control" value={form.companyName} onChange={set("companyName")} required maxLength={40} placeholder="e.g. Northwind" />
            <div className="field-hint">Shown as the brand in the sidebar and on the login screen.</div>
          </div>

          <div className="field-row">
            <div className="field">
              <label className="field-label">Full name</label>
              <input className="field-control" value={form.name} onChange={set("name")} required maxLength={60} />
            </div>
            <div className="field">
              <label className="field-label">Designation</label>
              <input className="field-control" value={form.designation} onChange={set("designation")} required maxLength={60} placeholder="e.g. Developer" />
            </div>
          </div>

          <div className="field">
            <label className="field-label">Email address</label>
            <input className="field-control" type="email" value={form.email} onChange={set("email")} required />
          </div>

          <div className="field-row">
            <div className="field">
              <label className="field-label">Department</label>
              <select className="field-control" value={form.deptId} onChange={set("deptId")}>
                {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field-label">Daily target (hours)</label>
              <input className="field-control" type="number" min="1" max="24" step="0.5" value={form.targetHours} onChange={set("targetHours")} required />
              <div className="field-hint">Drives your progress bar on My Attendance.</div>
            </div>
          </div>

          {/* Locked fields, shown for context */}
          <div className="field-row" style={{ marginTop: 4 }}>
            <div className="field">
              <label className="field-label">Role (locked)</label>
              <input className="field-control field-locked" value={user.role} disabled style={{ textTransform: "capitalize" }} />
            </div>
            <div className="field">
              <label className="field-label">Joined (locked)</label>
              <input className="field-control field-locked" value={joined} disabled />
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <button type="submit" className="btn primary" disabled={saving}>
              <Check size={15} style={{ marginRight: 6, verticalAlign: "-2px" }} /> {saving ? "Saving…" : "Save changes"}
            </button>
            <button type="button" className="btn ghost" onClick={cancelEdit} disabled={saving}>Cancel</button>
          </div>
        </form>
      ) : (
        /* ---- VIEW MODE ---- */
        <div className="card">
          <div className="card-title">Account Details</div>
          <div className="card-sub">Your information on file</div>
          <ViewRow icon={Building} label="Company" value={companyName} />
          <ViewRow icon={User} label="Full name" value={user.name} />
          <ViewRow icon={Briefcase} label="Designation" value={user.designation} />
          <ViewRow icon={Mail} label="Email" value={user.email} />
          <ViewRow icon={Building2} label="Department" value={deptName} />
          <ViewRow icon={Clock} label="Daily target" value={`${user.targetHours} hours`} />
          <ViewRow icon={Shield} label="Role" value={<span style={{ textTransform: "capitalize" }}>{user.role}</span>} locked />
          <ViewRow icon={CalendarDays} label="Joined" value={joined} locked />
          <div className="row-between" style={{ padding: "14px 0 0" }}>
            <span style={{ fontSize: 14, color: "var(--ink-soft)", display: "flex", alignItems: "center", gap: 10 }}>
              <BadgeCheck size={16} /> Employee ID
            </span>
            <span style={{ fontSize: 14, fontWeight: 500 }}>#{String(user.id).padStart(4, "0")}</span>
          </div>

          <button className="btn ghost" style={{ marginTop: 20 }} onClick={logout}>Sign out</button>
        </div>
      )}

      {/* Appearance now lives in the dedicated Settings panel */}
      <Link to="/settings" className="card settings-pointer" style={{ marginTop: 18 }}>
        <div className="stat-icon" style={{ background: "var(--teal-soft)" }}><Palette size={17} color="var(--teal)" /></div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 500 }}>Appearance & theme</div>
          <div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>Theme, accent colour, background & more — open Settings</div>
        </div>
        <ChevronRight size={18} color="var(--ink-soft)" />
      </Link>
    </>
  );
}
