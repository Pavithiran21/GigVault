import { IconArrowRight } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { listPayments } from '../../api/payments';
import { queryKeys } from '../../api/queryKeys';
import { formatDayShort, monthName } from '../../lib/dates';
import { methodLabel } from '../../lib/enums';
import { formatMoney } from '../../lib/money';

/**
 * Month view (owner's choice, 1 Nov 2026): the hero's right side lists the month's payments,
 * newest first (a one-month trend would be a single point). Up to 5, then "See all N in Payments".
 */
export function MonthPayments({ period, paymentCount, currency }) {
  const params = { from: period.start, to: period.end, size: 5 };
  const { data } = useQuery({ queryKey: queryKeys.payments.list(params), queryFn: () => listPayments(params) });

  return (
    <div className="hero2-r list">
      <div className="mb-1 flex items-center">
        <b className="flex-1 text-white" style={{ font: '600 15px var(--font-display)' }}>
          Payments in {monthName(period.start.slice(0, 7))}
        </b>
        <span className="text-xs text-[#a9e8de]">Newest first</span>
      </div>
      {data?.items.map((payment) => (
        <div key={payment.id} className="mrow">
          <span>{formatDayShort(payment.receivedOn)}</span>
          <span className="min-w-0 font-semibold text-white">
            <span className="block truncate">{payment.gigTitle}</span>
            <small className="block truncate">
              {payment.clientName} · {methodLabel(payment.method)}
            </small>
          </span>
          <b>{formatMoney(payment.amount, currency)}</b>
        </div>
      ))}
      <Link className="hero-link" to={`/payments?from=${period.start}&to=${period.end}`}>
        See all {paymentCount} in Payments <IconArrowRight size={16} aria-hidden="true" />
      </Link>
    </div>
  );
}
