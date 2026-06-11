// A month grid that colours each day by its attendance status.
// `days` is the array from monthlyForEmployee(): [{ date, weekday, status, ... }].
import { styleFor } from "./attendanceStatus";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function MonthCalendar({ days = [] }) {
  if (!days.length) return null;
  const lead = days[0].weekday; // blank cells before the 1st

  return (
    <div className="month-cal">
      <div className="month-cal-grid">
        {DOW.map((d) => (
          <div key={d} className="month-cal-dow">{d}</div>
        ))}
        {Array.from({ length: lead }).map((_, i) => (
          <div key={`b${i}`} className="month-cal-cell empty" />
        ))}
        {days.map((d) => {
          const st = styleFor(d.status);
          const dayNum = Number(d.date.slice(8, 10));
          return (
            <div
              key={d.date}
              className="month-cal-cell"
              style={{ background: st.soft, borderColor: st.soft === "transparent" ? "var(--line)" : "transparent" }}
              title={`${d.date} · ${st.label}`}
            >
              <span className="month-cal-day">{dayNum}</span>
              <span className="month-cal-dot" style={{ background: st.color }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
