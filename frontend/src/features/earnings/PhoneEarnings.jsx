import { IconCash } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { listGigs } from '../../api/gigs';
import { queryKeys } from '../../api/queryKeys';
import { formatDayShort, monthName } from '../../lib/dates';
import { formatMoney, shareOf } from '../../lib/money';
import { periodTitle } from '../../lib/period';
import { RecordPaymentDialog } from '../payments/RecordPaymentDialog';

const OWED_SHOWN = 3;
const owedParams = (paymentStatus) => ({ paymentStatus, sort: 'dueDate', size: 100 });

/**
 * "Owed to you": part-paid and unpaid gigs, soonest due first. The gigs filter takes one payment
 * status at a time, so this is two list calls merged by due date (PROJECT-PLAN.md decision log).
 */
function useOwedGigs() {
  const partly = useQuery({
    queryKey: queryKeys.gigs.list(owedParams('partly_paid')),
    queryFn: () => listGigs(owedParams('partly_paid')),
  });
  const unpaid = useQuery({
    queryKey: queryKeys.gigs.list(owedParams('unpaid')),
    queryFn: () => listGigs(owedParams('unpaid')),
  });
  const gigs = [...(partly.data?.items ?? []), ...(unpaid.data?.items ?? [])].sort((a, b) =>
    a.dueDate.localeCompare(b.dueDate),
  );
  return { gigs, isPending: partly.isPending || unpaid.isPending };
}

/**
 * The phone's Earnings (UI-UX.md screen 23): the year's earned card, this month and outstanding,
 * the gigs owed to you (up to 3; a tap opens the gig) and Record payment with a Gig choice.
 */
export function PhoneEarnings({ dashboard }) {
  const navigate = useNavigate();
  const { gigs, isPending } = useOwedGigs();
  const [paying, setPaying] = useState(false);
  const { currency } = dashboard;

  return (
    <>
      <div className="k-accent p-3.5">
        <small className="relative z-[1]">{periodTitle(dashboard.period)}</small>
        <span className="rs relative z-[1] block text-[26px]">{formatMoney(dashboard.earned, currency)}</span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="card p-2.5">
          <small className="muted text-xs">{monthName(dashboard.thisMonth.month)}</small>
          <div className="rs text-[15px]">{formatMoney(dashboard.thisMonth.earned, currency)}</div>
        </div>
        <div className="card p-2.5">
          <small className="muted text-xs">Outstanding</small>
          <div className="rs text-[15px] text-amber">{formatMoney(dashboard.outstanding.amount, currency)}</div>
        </div>
      </div>
      <h3 className="mt-3.5 mb-1.5 text-sm">Owed to you</h3>
      <div className="card overflow-hidden">
        {!isPending && gigs.length === 0 && <p className="muted m-0 p-3.5 text-sm">Nobody owes you anything right now.</p>}
        {gigs.slice(0, OWED_SHOWN).map((gig, index) => (
          <button
            key={gig.id}
            type="button"
            className="gig w-full border-0 bg-transparent text-left"
            style={index === Math.min(gigs.length, OWED_SHOWN) - 1 ? { borderBottom: 0 } : undefined}
            onClick={() => navigate(`/gigs/${gig.id}`)}
          >
            <b className="truncate text-sm">{gig.title}</b>
            <b className="rs text-sm">{formatMoney(gig.outstanding, currency)}</b>
            <small className="col-span-full truncate">
              {gig.clientName} · due {formatDayShort(gig.dueDate)}
            </small>
            <span className="bar2" aria-hidden="true">
              <span style={{ width: `${shareOf(gig.receivedAmount, gig.agreedAmount)}%` }} />
            </span>
          </button>
        ))}
      </div>
      {gigs.length > 0 && (
        <button type="button" className="btn btn-teal mt-3 w-full" onClick={() => setPaying(true)}>
          <IconCash size={18} aria-hidden="true" /> Record payment
        </button>
      )}
      {paying && <RecordPaymentDialog gigs={gigs} onClose={() => setPaying(false)} />}
    </>
  );
}
