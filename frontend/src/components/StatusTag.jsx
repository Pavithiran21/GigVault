import { PAYMENT_STATUSES, paymentStatusLabel, workStatusLabel } from '../lib/enums';

/** Unpaid, Part paid or Paid: worked out by the backend, always with text (never colour alone). */
export function PaymentTag({ status }) {
  const tagClass = PAYMENT_STATUSES.find((item) => item.value === status)?.tagClass ?? 's-work';
  return <span className={`st ${tagClass}`}>{paymentStatusLabel(status)}</span>;
}

/** Pending, In progress or Delivered: set by the user. */
export function WorkTag({ status }) {
  return <span className="st s-work">{workStatusLabel(status)}</span>;
}
