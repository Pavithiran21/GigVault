// Two kinds of time, kept apart (FRONTEND.md "Money and dates"):
// - Calendar dates (a gig's start and due dates, a payment's "received on") arrive as "2026-10-15".
//   They are read from their parts and never pass through new Date(), so a time zone can't move
//   "15 Oct" to "14 Oct". The weekday uses Date.UTC, which has no time zone either.
// - Timestamps (createdAt) are moments in UTC and are shown in the user's time zone.

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function parts(isoDate) {
  const [year, month, day] = isoDate.slice(0, 10).split('-').map(Number);
  return { year, month, day };
}

/** "2026-10-15" → "Thu 15 Oct 2026" (tables). */
export function formatDayLong(isoDate) {
  const { year, month, day } = parts(isoDate);
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return `${weekday} ${day} ${MONTHS_SHORT[month - 1]} ${year}`;
}

/** "2026-10-15" → "15 Oct" (lists). */
export function formatDayShort(isoDate) {
  const { month, day } = parts(isoDate);
  return `${day} ${MONTHS_SHORT[month - 1]}`;
}

/** "2026-10-15" → "15 Oct 2026". */
export function formatDay(isoDate) {
  const { year, month, day } = parts(isoDate);
  return `${day} ${MONTHS_SHORT[month - 1]} ${year}`;
}

/** "1 Oct – 31 Oct 2026", or "1 Apr 2025 – 31 Oct 2026" across years. */
export function formatRange(fromDate, toDate) {
  const from = parts(fromDate);
  const to = parts(toDate);
  const start = from.year === to.year ? formatDayShort(fromDate) : formatDay(fromDate);
  return `${start} – ${formatDay(toDate)}`;
}

/** "2026-10" → "October". */
export function monthName(yearMonth) {
  return MONTHS_LONG[Number(yearMonth.slice(5, 7)) - 1];
}

/** "2026-10" → "Oct". */
export function monthShort(yearMonth) {
  return MONTHS_SHORT[Number(yearMonth.slice(5, 7)) - 1];
}

/** "2026-10" → "October 2026". */
export function monthYear(yearMonth) {
  return `${monthName(yearMonth)} ${yearMonth.slice(0, 4)}`;
}

/** Today's calendar date in a time zone, as "2026-10-15" (en-CA writes dates as YYYY-MM-DD). */
export function todayIn(timeZone) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(),
  );
}

/** A UTC timestamp's month in the user's time zone: "Mar 2026" ("Client since Mar 2026"). */
export function timestampMonthYear(timestamp, timeZone) {
  return new Intl.DateTimeFormat('en-GB', { timeZone, month: 'short', year: 'numeric' }).format(new Date(timestamp));
}

/** A UTC timestamp's day in the user's time zone: "1 Oct" (when a file was added). */
export function timestampDayShort(timestamp, timeZone) {
  return new Intl.DateTimeFormat('en-GB', { timeZone, day: 'numeric', month: 'short' }).format(new Date(timestamp));
}

function lastDayOfMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** The first and last day of the month that holds isoDate: ["2026-10-01", "2026-10-31"]. */
export function monthBounds(isoDate) {
  const { year, month } = parts(isoDate);
  const mm = String(month).padStart(2, '0');
  return [`${year}-${mm}-01`, `${year}-${mm}-${String(lastDayOfMonth(year, month)).padStart(2, '0')}`];
}

/** A filter chip's label: "Oct 2026" for one whole month, otherwise "1 Oct – 31 Oct 2026". */
export function rangeLabel(fromDate, toDate) {
  const [first, last] = monthBounds(fromDate);
  if (fromDate === first && toDate === last) {
    const { year, month } = parts(fromDate);
    return `${MONTHS_SHORT[month - 1]} ${year}`;
  }
  return formatRange(fromDate, toDate);
}

/** Days from one calendar date to another (UTC midnights, so daylight saving can't change it). */
export function daysBetween(fromDate, toDate) {
  const a = parts(fromDate);
  const b = parts(toDate);
  return (Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86400000;
}

/** True for a "YYYY-MM-DD" string, which is what <input type="date"> gives. */
export function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value ?? '');
}
