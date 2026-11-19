import { z } from 'zod';
import { isIsoDate } from '../../lib/dates';
import { amountError } from '../../lib/money';

/** An amount typed as text: more than 0, at most 2 decimals, below 10,000,000,000 (UI-UX.md). */
export const amountField = z.string().superRefine((value, ctx) => {
  const message = amountError(value);
  if (message) {
    ctx.addIssue({ code: 'custom', message });
  }
});

/** Record payment (UI-UX.md screen 10). today is the user's today, in their time zone. */
export function paymentSchema(today) {
  return z.object({
    gigId: z.string(),
    amount: amountField,
    receivedOn: z.string().superRefine((value, ctx) => {
      if (!isIsoDate(value)) {
        ctx.addIssue({ code: 'custom', message: 'Enter the date you were paid.' });
      } else if (value > today) {
        // ISO dates compare correctly as text.
        ctx.addIssue({ code: 'custom', message: 'That date is in the future.' });
      }
    }),
    method: z.string(),
  });
}

export const PAYMENT_FIELDS = ['amount', 'receivedOn', 'method'];
