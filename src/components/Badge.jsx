const MAP = {
  Present: "green", Working: "teal", Absent: "rose", "On Leave": "amber",
  Active: "green", Approved: "green", Pending: "amber", Rejected: "rose", Paid: "green",
  // Monthly attendance statuses
  "Half Day": "amber", Leave: "violet", Weekend: "gray", Holiday: "teal",
  Upcoming: "gray", "Not employed": "gray",
};

export default function Badge({ status }) {
  const tone = MAP[status] || "gray";
  return <span className={`badge ${tone}`}>{status}</span>;
}
