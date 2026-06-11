// UI styling for the monthly attendance statuses. The status strings come from
// shared/attendance.js (STATUS); this maps each to a colour for calendar cells,
// legends and charts. Colours use CSS vars so they follow the theme.
import { STATUS } from "../../shared/attendance.js";

export const STATUS_STYLE = {
  [STATUS.PRESENT]: { label: "Present", color: "var(--green)", soft: "var(--green-soft)" },
  [STATUS.HALF]:    { label: "Half Day", color: "var(--amber)", soft: "var(--amber-soft)" },
  [STATUS.ABSENT]:  { label: "Absent", color: "var(--rose)", soft: "var(--rose-soft)" },
  [STATUS.LEAVE]:   { label: "Leave", color: "#8268d6", soft: "rgba(124,92,209,0.15)" },
  [STATUS.WEEKEND]: { label: "Weekend", color: "var(--ink-soft)", soft: "rgba(120,130,128,0.12)" },
  [STATUS.HOLIDAY]: { label: "Holiday", color: "var(--teal)", soft: "var(--teal-soft)" },
  [STATUS.UPCOMING]:{ label: "Upcoming", color: "var(--ink-soft)", soft: "transparent" },
  [STATUS.PENDING]: { label: "Pending", color: "var(--amber)", soft: "rgba(217,138,43,0.10)" },
};

export const styleFor = (status) => STATUS_STYLE[status] || STATUS_STYLE[STATUS.UPCOMING];

// Order used for legends and summary chips.
export const SUMMARY_ITEMS = [
  { key: "present", status: STATUS.PRESENT },
  { key: "halfDay", status: STATUS.HALF },
  { key: "absent", status: STATUS.ABSENT },
  { key: "leave", status: STATUS.LEAVE },
  { key: "weekend", status: STATUS.WEEKEND },
  { key: "holiday", status: STATUS.HOLIDAY },
];
