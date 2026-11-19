import { z } from 'zod';
import { isIsoDate } from '../../lib/dates';
import { amountField } from '../payments/paymentSchema';

// New gig and Edit gig (UI-UX.md screen 9); the same rules and messages as the backend.
export const gigSchema = z
  .object({
    clientId: z.string().min(1, 'Pick one of your clients.'),
    title: z.string().trim().min(1, 'Enter a title for this gig.').max(150, 'Use at most 150 characters.'),
    agreedAmount: amountField,
    startDate: z.string().refine(isIsoDate, 'Enter the start date.'),
    dueDate: z.string().refine(isIsoDate, 'Enter the due date.'),
    workStatus: z.enum(['pending', 'in_progress', 'delivered']),
  })
  .refine((gig) => !isIsoDate(gig.startDate) || !isIsoDate(gig.dueDate) || gig.dueDate >= gig.startDate, {
    path: ['dueDate'],
    message: "Due date can't be before the start date.",
  });

export const GIG_FIELDS = ['clientId', 'title', 'agreedAmount', 'startDate', 'dueDate', 'workStatus'];
