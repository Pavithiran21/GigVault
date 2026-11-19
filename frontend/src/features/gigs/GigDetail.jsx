import {
  IconArrowLeft,
  IconCalendar,
  IconCash,
  IconCircleCheck,
  IconFileSearch,
  IconPencil,
  IconTrash,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { getGig } from '../../api/gigs';
import { listGigPayments } from '../../api/payments';
import { queryKeys } from '../../api/queryKeys';
import { useAuth } from '../../auth/AuthContext';
import { ErrorPanel, Skeleton } from '../../components/StatePanels';
import { PaymentTag, WorkTag } from '../../components/StatusTag';
import { formatDay, formatDayLong, formatRange } from '../../lib/dates';
import { methodLabel, plural } from '../../lib/enums';
import { formatMoney, percentPaid, shareOf } from '../../lib/money';
import { DeletePaymentDialog } from '../payments/DeletePaymentDialog';
import { RecordPaymentDialog } from '../payments/RecordPaymentDialog';
import { Attachments } from './Attachments';
import { DeleteGigDialog } from './DeleteGigDialog';

/** A gig's payments, oldest first, for the table and the segmented bar (up to 100; FRONTEND.md "Limits"). */
const PAYMENT_PARAMS = { size: 100, sort: 'receivedOn' };
const SEGMENT_COLOURS = ['#0f766e', '#14b8a6'];

/** "Gig not found", also for another user's gig, so a link never reveals it (UI-UX.md "States"). */
export function GigNotFound() {
  return (
    <div className="card pad mx-auto max-w-sm text-center">
      <IconFileSearch size={40} className="mx-auto text-teal-700" aria-hidden="true" />
      <h3 className="mt-2 mb-1 text-[18px]">Gig not found</h3>
      <p className="muted mt-0 mb-3.5 text-sm">It may have been deleted, or the link is wrong.</p>
      <Link to="/gigs" className="btn btn-line">
        <IconArrowLeft size={18} aria-hidden="true" /> Back to gigs
      </Link>
    </div>
  );
}

/** One segment per payment: how much of the agreed amount each one paid. */
function PaymentsBar({ gig, payments }) {
  const percent = percentPaid(gig.receivedAmount, gig.agreedAmount);
  return (
    <>
      <div className="progress" role="img" aria-label={`${percent} percent paid`}>
        {payments.map((payment, index) => (
          <span
            key={payment.id}
            style={{
              width: `${shareOf(payment.amount, gig.agreedAmount)}%`,
              background: SEGMENT_COLOURS[index % 2],
              borderLeft: index > 0 ? '2px solid #fff' : undefined,
            }}
          />
        ))}
      </div>
      <div className="muted mt-1.5 mb-4 text-[13px]">
        {gig.paymentCount > 0 ? `${percent}% paid in ${plural(gig.paymentCount, 'payment')}. ` : 'Nothing paid yet. '}
        Payment status is worked out from payments; you can&apos;t set it by hand.
      </div>
    </>
  );
}

/**
 * The read-only gig view (UI-UX.md "Gigs screen"): a click on a gig opens this; Edit swaps it for
 * the form in the same pane. onBack is the phone's back arrow.
 */
export function GigDetail({ gigId, onEdit, onDeleted, onBack }) {
  const { user } = useAuth();
  const currency = user.defaultCurrency;
  const [dialog, setDialog] = useState(null); // { type: 'pay' | 'delete-gig' | 'delete-payment', payment? }

  const gigQuery = useQuery({ queryKey: queryKeys.gigs.detail(gigId), queryFn: () => getGig(gigId) });
  const paymentsQuery = useQuery({
    queryKey: queryKeys.gigs.payments(gigId),
    queryFn: () => listGigPayments(gigId, PAYMENT_PARAMS),
  });

  if (gigQuery.isPending) {
    return <Skeleton label="Opening gig…" lines={5} />;
  }
  if (gigQuery.isError) {
    return gigQuery.error.status === 404 ? (
      <GigNotFound />
    ) : (
      <ErrorPanel title="Couldn't load this gig" onRetry={() => gigQuery.refetch()} />
    );
  }

  const gig = gigQuery.data;
  const payments = paymentsQuery.data?.items ?? [];
  const paidInFull = gig.paymentStatus === 'paid';

  return (
    <article aria-labelledby="gig-title">
      <div className="flex flex-wrap items-start gap-2.5">
        <div className="min-w-[220px] flex-1">
          <div className="flex items-center gap-2">
            {onBack && (
              <button type="button" className="icon-btn sm" aria-label="Back to gigs" onClick={onBack}>
                <IconArrowLeft size={16} aria-hidden="true" />
              </button>
            )}
            <nav aria-label="Breadcrumb" className="text-[13px]">
              <Link className="crumb" to={`/clients/${gig.clientId}`}>
                {gig.clientName}
              </Link>
              <span className="muted"> / </span>
              <Link className="crumb" to="/gigs">
                Gigs
              </Link>
            </nav>
          </div>
          <h2 id="gig-title" className="mt-0.5 mb-2 text-[26px] break-words">
            {gig.title}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <WorkTag status={gig.workStatus} />
            <PaymentTag status={gig.paymentStatus} />
            <span className="muted inline-flex items-center gap-1 text-[13px]">
              <IconCalendar size={14} aria-hidden="true" /> {formatRange(gig.startDate, gig.dueDate)}
            </span>
          </div>
        </div>
        <div className="gig-actions">
          <button type="button" className="btn btn-line" onClick={onEdit}>
            <IconPencil size={18} aria-hidden="true" /> Edit
          </button>
          <button
            type="button"
            className="btn btn-teal pay"
            disabled={paidInFull}
            aria-describedby={paidInFull ? 'paid-in-full' : undefined}
            onClick={() => setDialog({ type: 'pay' })}
          >
            <IconCash size={18} aria-hidden="true" /> Record payment
          </button>
          <button
            type="button"
            className="icon-btn danger lg"
            aria-label="Delete gig"
            onClick={() => setDialog({ type: 'delete-gig' })}
          >
            <IconTrash size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
      {paidInFull && (
        <div className="hint flex items-center gap-1.5" id="paid-in-full">
          <IconCircleCheck size={16} className="text-green" aria-hidden="true" /> Paid in full. Nothing left to record.
        </div>
      )}

      <div className="ledger">
        <div>
          <small>Agreed</small>
          <span className="rs">{formatMoney(gig.agreedAmount, currency)}</span>
        </div>
        <div>
          <small>Received</small>
          <span className="rs text-green">{formatMoney(gig.receivedAmount, currency)}</span>
        </div>
        <div>
          <small>Outstanding</small>
          <span className="rs text-amber">{formatMoney(gig.outstanding, currency)}</span>
        </div>
      </div>
      <PaymentsBar gig={gig} payments={payments} />

      <div className="card flat overflow-hidden">
        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                <th>Received on</th>
                <th>Method</th>
                <th className="text-right">Amount</th>
                <th>
                  <span className="sr">Delete</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {paymentsQuery.isPending && (
                <tr>
                  <td colSpan={4}>
                    <Skeleton label="Loading payments…" lines={2} />
                  </td>
                </tr>
              )}
              {paymentsQuery.isSuccess && payments.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted">
                    No payments yet.
                  </td>
                </tr>
              )}
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td className="whitespace-nowrap">{formatDayLong(payment.receivedOn)}</td>
                  <td>{methodLabel(payment.method)}</td>
                  <td className="rs text-right whitespace-nowrap">{formatMoney(payment.amount, currency)}</td>
                  <td className="text-right">
                    <button
                      type="button"
                      className="icon-btn sm danger ml-auto"
                      aria-label={`Delete payment of ${formatMoney(payment.amount, currency)} on ${formatDay(payment.receivedOn)}`}
                      onClick={() => setDialog({ type: 'delete-payment', payment })}
                    >
                      <IconTrash size={16} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Attachments gig={gig} />

      {dialog?.type === 'pay' && <RecordPaymentDialog gigs={[gig]} onClose={() => setDialog(null)} />}
      {dialog?.type === 'delete-payment' && (
        <DeletePaymentDialog payment={dialog.payment} onClose={() => setDialog(null)} />
      )}
      {dialog?.type === 'delete-gig' && (
        <DeleteGigDialog gig={gig} onDeleted={onDeleted} onClose={() => setDialog(null)} />
      )}
    </article>
  );
}
