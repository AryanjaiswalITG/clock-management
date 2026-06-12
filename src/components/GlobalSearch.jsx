// Header search. Indexes the people the caller can see (scoped by role) plus the
// pages available to their role, and jumps to a match. Replaces the old no-op box.
import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ArrowRight } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useData } from "../data/DataContext";

// Pages each role can navigate to (kept in sync with App.jsx routing).
const PAGES = {
  admin: [
    ["Dashboard", "/"], ["Employees", "/employees"], ["Org Chart", "/org"],
    ["Attendance", "/attendance"], ["Leave Management", "/leave"], ["Payroll", "/payroll"],
    ["My Profile", "/profile"], ["Settings", "/settings"],
  ],
  manager: [
    ["My Attendance", "/"], ["My Team", "/team"], ["Team Attendance", "/attendance"],
    ["Leave & Approvals", "/leave"], ["My Profile", "/profile"], ["Settings", "/settings"],
  ],
  employee: [
    ["My Attendance", "/"], ["Leave", "/leave"], ["My Profile", "/profile"], ["Settings", "/settings"],
  ],
};

export default function GlobalSearch() {
  const { user } = useAuth();
  const { employees, deptName } = useData();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  const pages = PAGES[user?.role] || PAGES.employee;
  // Where a "person" result should take you: admins to the directory, managers
  // to their team, employees nowhere new (they only see themselves).
  const peopleDest = user?.role === "admin" ? "/employees" : user?.role === "manager" ? "/team" : "/profile";

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return { people: [], pages: [] };
    const people = (employees || [])
      .filter((e) =>
        e.name.toLowerCase().includes(term) ||
        e.email.toLowerCase().includes(term) ||
        (e.designation || "").toLowerCase().includes(term))
      .slice(0, 6);
    const matchedPages = pages.filter(([label]) => label.toLowerCase().includes(term)).slice(0, 5);
    return { people, pages: matchedPages };
  }, [q, employees, pages]);

  // Close on click-outside.
  useEffect(() => {
    const onClick = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function go(to) {
    navigate(to);
    setQ("");
    setOpen(false);
  }

  const hasResults = results.people.length > 0 || results.pages.length > 0;

  return (
    <div className="search-wrap" ref={boxRef}>
      <div className="search">
        <Search size={16} />
        <input
          placeholder="Search people, pages…"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => { if (e.key === "Escape") { setQ(""); setOpen(false); e.currentTarget.blur(); } }}
        />
      </div>

      {open && q.trim() && (
        <div className="search-results" role="listbox">
          {!hasResults && <div className="search-empty">No matches for “{q.trim()}”.</div>}

          {results.people.length > 0 && (
            <div className="search-group">
              <div className="search-group-label">People</div>
              {results.people.map((e) => (
                <button key={e.id} type="button" className="search-item" onClick={() => go(peopleDest)}>
                  <span className="emp-avatar" style={{ width: 28, height: 28, fontSize: 11 }}>{e.avatar}</span>
                  <span className="search-item-text">
                    <span className="search-item-title">{e.name}</span>
                    <span className="search-item-sub">{e.designation}{e.deptId ? ` · ${deptName(e.deptId)}` : ""}</span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {results.pages.length > 0 && (
            <div className="search-group">
              <div className="search-group-label">Pages</div>
              {results.pages.map(([label, to]) => (
                <button key={to} type="button" className="search-item" onClick={() => go(to)}>
                  <span className="search-item-icon"><ArrowRight size={15} /></span>
                  <span className="search-item-text"><span className="search-item-title">{label}</span></span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
