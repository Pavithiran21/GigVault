import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { deleteGig } from '../../api/gigs';
import { invalidateMoneyData } from '../../api/invalidate';
import { queryKeys } from '../../api/queryKeys';
import { useAuth } from '../../auth/AuthContext';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { errorMessage, isNetworkError } from '../../lib/apiErrors';
import { plural } from '../../lib/enums';
import { formatMoney } from '../../lib/money';
import { useToast } from '../../toast/ToastContext';

/** What deleting the gig takes with it, in words (UI-UX.md screen 19). */
function effectText(gig, currency) {
  const payments = gig.paymentCount > 0 ? `${plural(gig.paymentCount, 'payment')} (${formatMoney(gig.receivedAmount, currency)} received)` : null;
  const files = gig.attachmentCount > 0 ? plural(gig.attachmentCount, 'file') : null;
  if (!payments && !files) {
    return "This gig has no payments or files. This can't be undone.";
  }
  const things = [payments, files].filter(Boolean).join(' and ');
  const verb = gig.paymentCount + gig.attachmentCount === 1 ? 'is' : 'are';
  const earnings = payments ? ', and your earnings drop by that amount' : '';
  return `Its ${things} ${verb} deleted too${earnings}. This can't be undone.`;
}

/** Deletes the gig with its payments and files, in one transaction on the backend. */
export function DeleteGigDialog({ gig, onDeleted, onClose }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { showToast, showError } = useToast();
  const [error, setError] = useState(null);

  const remove = useMutation({
    mutationFn: () => deleteGig(gig.id),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: queryKeys.gigs.detail(gig.id) });
      invalidateMoneyData(queryClient);
      showToast({ message: 'Gig deleted' });
      onDeleted();
    },
    onError: (deleteError) => {
      if (isNetworkError(deleteError)) {
        showError(deleteError.message, { network: true });
      } else {
        setError(errorMessage(deleteError));
      }
    },
  });

  return (
    <ConfirmDialog
      title={`Delete ${gig.title}?`}
      keepLabel="Keep gig"
      confirmLabel="Delete gig"
      pending={remove.isPending}
      error={error}
      onConfirm={() => remove.mutate()}
      onClose={onClose}
    >
      {effectText(gig, user.defaultCurrency)}
    </ConfirmDialog>
  );
}
