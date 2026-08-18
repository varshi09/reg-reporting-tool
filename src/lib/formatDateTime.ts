// Every timestamp in this app is stored as GST (see db.ts's sessionCallback
// and the LOCALTIMESTAMP convention). Display must be pinned to the same
// zone explicitly - without this, toLocaleString() falls back to the
// viewer's own browser/OS timezone, which would show a different clock
// time than what's actually stored for the exact same instant.
const GST_TIME_ZONE = "Asia/Dubai";

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    timeZone: GST_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
