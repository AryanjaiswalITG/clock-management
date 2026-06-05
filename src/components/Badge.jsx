const MAP = {
  Present: "green", Working: "teal", Absent: "rose", "On Leave": "amber",
  Active: "green", Approved: "green", Pending: "amber", Rejected: "rose",
};

export default function Badge({ status }) {
  const tone = MAP[status] || "gray";
  return <span className={`badge ${tone}`}>{status}</span>;
}
