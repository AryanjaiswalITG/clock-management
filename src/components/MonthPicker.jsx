// Prev / next month navigator. `value` is { year, month } with month 1-12.
import { ChevronLeft, ChevronRight } from "lucide-react";

const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

export default function MonthPicker({ value, onChange, max }) {
  const { year, month } = value;
  const shift = (delta) => {
    let m = month + delta, y = year;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    if (max && (y > max.year || (y === max.year && m > max.month))) return; // don't go past current month
    onChange({ year: y, month: m });
  };
  const atMax = max && year === max.year && month === max.month;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <button className="btn ghost sm" onClick={() => shift(-1)} aria-label="Previous month"><ChevronLeft size={16} /></button>
      <span style={{ minWidth: 130, textAlign: "center", fontWeight: 600 }}>{MONTHS[month - 1]} {year}</span>
      <button className="btn ghost sm" onClick={() => shift(1)} disabled={atMax} aria-label="Next month"><ChevronRight size={16} /></button>
    </div>
  );
}
