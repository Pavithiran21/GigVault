import { IconTrash } from '@tabler/icons-react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { listPayments } from '../../api/payments';
import { queryKeys } from '../../api/queryKeys';
import { useAuth } from '../../auth/AuthContext';
import { Pager } from '../../components/Pager';
import { ErrorPanel, Skeleton } from '../../components/StatePanels';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useSearchParamsState } from '../../hooks/useSearchParamsState';
import { formatDay, formatDayLong } from '../../lib/dates';
import { methodLabel } from '../../lib/enums';
import { formatMoney } from '../../lib/money';
import { ClientFilterMenu, DatesFilter } from '../filters/FilterChips';
import { DeletePaymentDialog } from './DeletePaymentDialog';

const FILTER_KEYS = ['clientId', 'from', 'to', 'page'];

/**
 * Payments (UI-UX.md screen 14): every payment, newest first, by client and dates. A click on a row
 * opens its gig. Payments can't be edited: a wrong one is deleted and recorded again.
 */
export function PaymentsPage() {
  usePageTitle('Payments');
  const { user } = useAuth();
  const navigate = useNavigate();
  const [filters, update] = useSearchParamsState(FILTER_KEYS);
  const [toDelete, setToDelete] = useState(null);
  const currency = user.defaultCurrency;

  const params = { clientId: filters.clientId, from: filters.from, to: filters.to, page: Number(filters.page) || 1 };
  const paymentsQuery = useQuery({
    queryKey: queryKeys.payments.list(params),
    queryFn: () => listPayments(params),
    placeholderData: keepPreviousData,
  });
  const data = paymentsQuery.data;
  const hasFilters = Boolean(filters.clientId || filters.from || filters.to);
  const clearFilters = () => update({ clientId: '', from: '', to: '' });

  return (
    <>
      <div className="head">
        <h2>Payments</h2>
        <div className="chips">
          <ClientFilterMenu value={filters.clientId} onChange={(value) => update({ clientId: value })} />
          <DatesFilter
            from={filters.from}
            to={filters.to}
            title="Payments received between"
            description="Shows payments received on or between these dates."
            onChange={(range) => update(range)}
          />
          {hasFilters && (
            <button type="button" className="link ml-0.5 text-[13px]" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>
      </div>

      {paymentsQuery.isPending && <Skeleton className="card pad" label="Loading payments…" lines={5} />}
      {paymentsQuery.isError && (
        <ErrorPanel title="Couldn't load your payments" onRetry={() => paymentsQuery.refetch()} />
      )}
      {data && data.totalItems === 0 && (
        <div className="card pad text-center">
          <b className="text-ink">{hasFilters ? 'No payments in this range.' : 'No payments yet.'}</b>
          <div className="muted mt-0.5 mb-2.5 text-sm">
            {hasFilters ? 'Try other dates or another client.' : 'Record a payment on a gig and it shows here.'}
          </div>
          {hasFilters && (
            <button type="button" className="btn btn-line" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>
      )}
      {data && data.totalItems > 0 && (
        <div className="card overflow-hidden">
          <div className="scroll-x">
            <table className="pay-table">
              <thead>
                <tr>
                  <th>Received on</th>
                  <th>Gig</th>
                  <th>Method</th>
                  <th className="text-right">Amount</th>
                  <th>
                    <span className="sr">Delete</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((payment) => (
                  <tr
                    key={payment.id}
                    className="row-click"
                    onClick={(event) => {
                      if (!event.target.closest('a, button')) navigate(`/gigs/${payment.gigId}`);
                    }}
                  >
                    <td className="whitespace-nowrap">{formatDayLong(payment.receivedOn)}</td>
                    <td>
                      <Link className="name" to={`/gigs/${payment.gigId}`}>
                        {payment.gigTitle}
                      </Link>
                      <div className="muted text-xs">{payment.clientName}</div>
                    </td>
                    <td>{methodLabel(payment.method)}</td>
                    <td className="rs text-right whitespace-nowrap">{formatMoney(payment.amount, currency)}</td>
                    <td className="text-right">
                      <button
                        type="button"
                        className="icon-btn sm danger ml-auto"
                        aria-label={`Delete payment of ${formatMoney(payment.amount, currency)} on ${formatDay(payment.receivedOn)}`}
                        onClick={() => setToDelete(payment)}
                      >
                        <IconTrash size={16} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager
            data={data}
            note="newest first"
            className="border-t border-line"
            onPage={(page) => update({ page })}
          />
        </div>
      )}

      {toDelete && <DeletePaymentDialog payment={toDelete} onClose={() => setToDelete(null)} />}
    </>
  );
}
