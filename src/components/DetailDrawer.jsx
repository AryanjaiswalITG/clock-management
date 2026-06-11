// Reusable right-side detail panel. One instance is reused for every kind of
// detail (e.g. an attendance day or status) — pass a title + children.
import { useEffect, useRef } from "react";
import { X } from "lucide-react";

export default function DetailDrawer({ open, onClose, title, subtitle, children }) {
  const closeRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden"; // lock background scroll while open
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <aside
        className="detail-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="detail-drawer-head">
          <div style={{ minWidth: 0 }}>
            <h3>{title}</h3>
            {subtitle && <div className="detail-drawer-sub">{subtitle}</div>}
          </div>
          <button ref={closeRef} className="detail-drawer-close" onClick={onClose} aria-label="Close panel">
            <X size={18} />
          </button>
        </div>
        <div className="detail-drawer-body">{children}</div>
      </aside>
    </div>
  );
}
