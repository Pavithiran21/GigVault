import { formatRange, monthName, monthYear } from './dates';

// Words for a dashboard period { type, start, end } (UI-UX.md "Earnings screen").

/** "Earned in 2026", "Earned in October 2026" or "Earned 1 Apr 2025 – 31 Oct 2026". */
export function periodTitle(period) {
  if (period.type === 'year') return `Earned in ${period.start.slice(0, 4)}`;
  if (period.type === 'month') return `Earned in ${monthYear(period.start.slice(0, 7))}`;
  return `Earned ${formatRange(period.start, period.end)}`;
}

/** "in 2026", "in October" or "1 Apr 2025 – 31 Oct 2026" (after "Paid" in the donut's caption). */
export function shortPeriod(period) {
  if (period.type === 'year') return `in ${period.start.slice(0, 4)}`;
  if (period.type === 'month') return `in ${monthName(period.start.slice(0, 7))}`;
  return formatRange(period.start, period.end);
}
