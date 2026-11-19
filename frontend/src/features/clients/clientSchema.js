import { z } from 'zod';
import { optionalEmailField } from '../auth/authSchemas';

// The add and edit client form (UI-UX.md screen 13); the same limits as the backend.
export const clientSchema = z.object({
  name: z.string().trim().min(1, "Enter the client's name.").max(120, 'Use at most 120 characters.'),
  contactName: z.string().trim().max(120, 'Use at most 120 characters.'),
  contactEmail: optionalEmailField,
  notes: z.string().trim().max(2000, 'Use at most 2000 characters.'),
});

export const CLIENT_FIELDS = ['name', 'contactName', 'contactEmail', 'notes'];

/** The form's starting values: empty for a new client, the client's own for an edit. */
export function clientFormValues(client) {
  return {
    name: client?.name ?? '',
    contactName: client?.contactName ?? '',
    contactEmail: client?.contactEmail ?? '',
    notes: client?.notes ?? '',
  };
}
