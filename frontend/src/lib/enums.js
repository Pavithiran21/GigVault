// The backend's fixed values and how the screen names them (UI-UX.md).

export const CURRENCIES = [
  { code: 'INR', name: 'Indian rupee' },
  { code: 'USD', name: 'US dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British pound' },
  { code: 'AUD', name: 'Australian dollar' },
  { code: 'CAD', name: 'Canadian dollar' },
  { code: 'SGD', name: 'Singapore dollar' },
  { code: 'AED', name: 'UAE dirham' },
];

export const WORK_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'delivered', label: 'Delivered' },
];

// Worked out by the backend from the payments; never set by hand.
export const PAYMENT_STATUSES = [
  { value: 'unpaid', label: 'Unpaid', tagClass: 's-unpaid' },
  { value: 'partly_paid', label: 'Part paid', tagClass: 's-part' },
  { value: 'paid', label: 'Paid', tagClass: 's-paid' },
];

export const PAYMENT_METHODS = [
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'other', label: 'Other' },
];

function labelOf(list, value) {
  return list.find((item) => item.value === value)?.label ?? value;
}

export const workStatusLabel = (value) => labelOf(WORK_STATUSES, value);
export const paymentStatusLabel = (value) => labelOf(PAYMENT_STATUSES, value);
export const methodLabel = (value) => labelOf(PAYMENT_METHODS, value);

/** "1 payment", "3 payments". */
export function plural(count, word) {
  return `${count} ${count === 1 ? word : `${word}s`}`;
}
