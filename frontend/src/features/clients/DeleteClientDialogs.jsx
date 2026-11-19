import { useId } from 'react';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Dialog } from '../../components/Dialog';
import { plural } from '../../lib/enums';

/** A client without gigs (UI-UX.md screen 21). */
export function DeleteClientDialog({ client, pending, error, onConfirm, onClose }) {
  return (
    <ConfirmDialog
      title={`Delete ${client.name}?`}
      keepLabel="Keep client"
      confirmLabel="Delete client"
      pending={pending}
      error={error}
      onConfirm={onConfirm}
      onClose={onClose}
    >
      This client has no gigs. Its contact details and notes are deleted. This can&apos;t be undone.
    </ConfirmDialog>
  );
}

/** A client with gigs can't be deleted: its gigs and payments would lose their client. */
export function ClientInUseDialog({ client, onClose }) {
  const titleId = useId();
  const textId = useId();
  return (
    <Dialog role="alertdialog" labelledBy={titleId} describedBy={textId} onClose={onClose}>
      <h3 id={titleId}>Can&apos;t delete {client.name} yet</h3>
      <p id={textId} className="muted mb-1.5 text-sm">
        This client has {plural(client.gigCount, 'gig')} and {plural(client.paymentCount, 'payment')}. Delete or
        move them first.
      </p>
      <div className="acts">
        <button type="button" className="btn btn-teal" data-autofocus onClick={onClose}>
          Got it
        </button>
      </div>
    </Dialog>
  );
}
