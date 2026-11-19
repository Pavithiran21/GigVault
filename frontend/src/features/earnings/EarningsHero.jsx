import { IconCoin, IconCoinRupee, IconInfoCircle, IconTrendingUp } from '@tabler/icons-react';
import { monthName, monthYear } from '../../lib/dates';
import { plural } from '../../lib/enums';
import { formatMoney, moneyParts, toCents } from '../../lib/money';
import { periodTitle } from '../../lib/period';
import { MonthPayments } from './MonthPayments';
import { TrendChart } from './TrendChart';

/** The coin before "Earned in …": a rupee coin for INR, a plain coin for the other currencies. */
function EarnedIcon({ currency }) {
  return currency === 'INR' ? <IconCoinRupee size={16} aria-hidden="true" /> : <IconCoin size={16} aria-hidden="true" />;
}

/**
 * The trend stops at this month: months that haven't happened yet (the rest of the year) would
 * otherwise be drawn as a drop to zero.
 */
function pastMonths(dashboard) {
  return dashboard.trend.filter((point) => point.month <= dashboard.thisMonth.month);
}

/**
 * The dark-teal hero (UI-UX.md "Earnings screen"): what was earned in the period, the chips, three
 * tiles, and on the right the trend chart (Year, Custom) or the month's payments (Month).
 * Every amount is the backend's exact string; nothing is added up here.
 */
export function EarningsHero({ dashboard, panelId, labelledBy }) {
  const { currency, period } = dashboard;
  const big = moneyParts(dashboard.earned, currency);
  const isMonth = period.type === 'month';
  const empty = dashboard.paymentCount === 0;
  const trend = pastMonths(dashboard);
  const bestMonth =
    dashboard.bestMonth &&
    (period.type === 'year' ? monthName(dashboard.bestMonth.month) : monthYear(dashboard.bestMonth.month));
  const owed = toCents(dashboard.outstanding.amount) > 0n;

  return (
    <section
      id={panelId}
      role="tabpanel"
      aria-labelledby={labelledBy}
      className={`hero2 ${empty || (!isMonth && trend.length === 0) ? 'single' : ''}`}
    >
      <div className="hero2-l">
        <small>
          <EarnedIcon currency={currency} /> {periodTitle(period)}
        </small>
        <div className="big">
          {big.symbol}
          {big.whole}
          <span>.{big.cents}</span>
        </div>
        <div className="pills">
          {empty ? (
            <span>
              <IconInfoCircle size={14} aria-hidden="true" /> No payments in this period yet
            </span>
          ) : (
            <>
              {bestMonth && !isMonth && (
                <span>
                  <IconTrendingUp size={14} aria-hidden="true" /> Best month: {bestMonth}
                </span>
              )}
              <span>{plural(dashboard.paymentCount, 'payment')}</span>
              <span>{plural(dashboard.clientCount, 'client')}</span>
            </>
          )}
        </div>
        <div className="hero2-stats">
          {/* Month view shows the year here, so the first tile doesn't repeat the hero. */}
          {isMonth ? (
            <div>
              <small>This year</small>
              <b>{formatMoney(dashboard.thisYear.earned, currency)}</b>
              <em>{plural(dashboard.thisYear.paymentCount, 'payment')}</em>
            </div>
          ) : (
            <div>
              <small>{monthName(dashboard.thisMonth.month)}</small>
              <b>{formatMoney(dashboard.thisMonth.earned, currency)}</b>
              <em>{plural(dashboard.thisMonth.paymentCount, 'payment')}</em>
            </div>
          )}
          <div>
            <small>Outstanding</small>
            <b className={owed ? 'owed' : ''}>{formatMoney(dashboard.outstanding.amount, currency)}</b>
            <em>on {plural(dashboard.outstanding.gigCount, 'gig')}</em>
          </div>
          <div>
            <small>Avg. per gig</small>
            <b>{formatMoney(dashboard.averagePerGig, currency)}</b>
            <em>{plural(dashboard.gigCount, 'gig')}</em>
          </div>
        </div>
      </div>
      {!empty && isMonth && <MonthPayments period={period} paymentCount={dashboard.paymentCount} currency={currency} />}
      {!empty && !isMonth && trend.length > 0 && (
        <div className="hero2-r">
          <TrendChart trend={trend} currency={currency} caption={`Earned per month, ${periodTitle(period).replace('Earned ', '')}`} />
        </div>
      )}
    </section>
  );
}
