// Shows a profile photo if `src` is set, otherwise the initials fallback.
// Reuses the existing .avatar / .emp-avatar circle styles via `className`.
export default function Avatar({ src, initials, className = "avatar", style }) {
  return (
    <div className={className} style={style}>
      {src ? <img src={src} alt={initials || "avatar"} className="avatar-photo" /> : initials}
    </div>
  );
}
