export function statusBadge(status: string) {
  const s = status.toUpperCase();
  if (
    ["ISSUED", "CLOSED", "DISPATCHED", "PASSED", "OPEN", "IN_STOCK", "LOW"].includes(
      s,
    )
  ) {
    return "badge badge-ok";
  }
  if (
    [
      "DRAFT",
      "RETURNED",
      "SENT_TO_MILL",
      "IN_PROCESS",
      "CONVERTED",
      "PENDING_QC",
      "MEDIUM",
    ].includes(s)
  ) {
    return "badge badge-warn";
  }
  if (["CANCELLED", "REJECT", "FAILED", "HIGH"].includes(s)) {
    return "badge badge-danger";
  }
  return "badge badge-muted";
}
