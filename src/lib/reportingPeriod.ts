/**
 * Shared reporting-calendar logic.
 *
 * Business rule: a reporting cycle run during month M reports the data as at
 * the END OF THE PREVIOUS MONTH. So the cycle worked on during August 2026
 * covers the period ending 31 July 2026.
 *
 * Everything in the app that needs "the current reporting period" must come
 * through here, so the dashboard, validation and upload history can never
 * drift apart on what period they mean.
 */

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const SHORT_MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export type ReportingPeriod = {
  /** Month-end date of the data being reported, as YYYYMMDD. */
  timeKey: string;
  /** YYYYMM prefix of the data period, for LIKE matching. */
  monthPrefix: string;
  /** The period the data covers, e.g. "July 2026". */
  periodLabel: string;
  /** The period end date, e.g. "31 Jul 2026". */
  periodDateLabel: string;
  /** The cycle being worked in, e.g. "August 2026". */
  cycleLabel: string;
  /** Quarter ends are Mar, Jun, Sep and Dec month-ends. */
  isQuarterEnd: boolean;
  /** Half-year ends are Jun and Dec month-ends. */
  isHalfYearEnd: boolean;
  /** Year end is the Dec month-end. */
  isYearEnd: boolean;
};

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

const GST_OFFSET_MS = 4 * 60 * 60 * 1000; // UTC+4, fixed, no DST

/**
 * "Now" as GST wall-clock calendar fields, independent of whatever
 * timezone the host machine (browser or server) actually runs in. Shifting
 * the absolute instant by the fixed +4h offset and then reading it back
 * with the UTC-suffixed getters yields GST's own year/month/day/hour
 * without the read being re-interpreted through a third, local timezone -
 * which matters because this same function decides the reporting-period
 * boundary from both the browser (viewer's own clock) and the server.
 */
function gstNow(): { year: number; monthIndex: number } {
  const shifted = new Date(Date.now() + GST_OFFSET_MS);
  return { year: shifted.getUTCFullYear(), monthIndex: shifted.getUTCMonth() };
}

/**
 * The reporting period for the cycle running at `now` — i.e. the month-end
 * immediately before `now`'s month. `now` defaults to the current instant
 * read as GST, not the caller's local time.
 */
export function getReportingPeriod(now?: { year: number; monthIndex: number }): ReportingPeriod {
  const { year: nowYear, monthIndex: nowMonthIndex } = now ?? gstNow();

  // Day 0 of the current month resolves to the last day of the previous
  // month, which handles year rollover and month lengths for us. Built in
  // UTC so this doesn't get re-shifted by the host's own local timezone.
  const periodEnd = new Date(Date.UTC(nowYear, nowMonthIndex, 0));

  const year = periodEnd.getUTCFullYear();
  const monthIndex = periodEnd.getUTCMonth(); // 0-based
  const monthNumber = monthIndex + 1; // 1-based
  const day = periodEnd.getUTCDate();

  return {
    timeKey: `${year}${pad2(monthNumber)}${pad2(day)}`,
    monthPrefix: `${year}${pad2(monthNumber)}`,
    periodLabel: `${MONTH_NAMES[monthIndex]} ${year}`,
    periodDateLabel: `${day} ${SHORT_MONTH_NAMES[monthIndex]} ${year}`,
    cycleLabel: `${MONTH_NAMES[nowMonthIndex]} ${nowYear}`,
    isQuarterEnd: [3, 6, 9, 12].includes(monthNumber),
    isHalfYearEnd: [6, 12].includes(monthNumber),
    isYearEnd: monthNumber === 12,
  };
}

/**
 * Which report frequencies fall due for a given period. Monthly is always
 * due; quarterly and half-yearly only on their respective month-ends.
 *
 * Weekly (every Friday) and bi-weekly are NOT modelled here — the weekly
 * rule was stated as "every Friday" and bi-weekly is still to be defined,
 * and neither maps onto a month-end period, so they need their own
 * calendar rather than being forced into this one.
 */
export function frequenciesDueForPeriod(period: ReportingPeriod): string[] {
  const due = ["Monthly"];
  if (period.isQuarterEnd) due.push("Quarterly");
  if (period.isHalfYearEnd) due.push("Half-yearly");
  if (period.isYearEnd) due.push("Annual");
  return due;
}
