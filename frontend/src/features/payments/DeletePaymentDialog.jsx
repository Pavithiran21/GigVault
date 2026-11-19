import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { getGig } from '../../api/gigs';
import { invalidateMoneyData } from '../../api/invalidate';
import { deletePayment } from '../../api/payments';
import { queryKeys } from '../../api/queryKeys';
import { useAuth } from '../../auth/AuthContext';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { errorMessage, isNetworkError } from '../../lib/apiErrors';
import { formatDayShort } from '../../lib/dates';
import { addMoney, formatMoney } from '../../lib/money';
import { useToast } from '../../toast/ToastContext';

/**
 * "Delete this payment?" (UI-UX.md screen 18), from a gig or from the Payments list. It names the
 * effect: the gig's outstanding amount after the delete, added exactly in integer cents.
 * Payments can't be edited: a wrong one is deleted and recorded again.
 */
export function DeletePaymentDialog({ payment, onClose }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { showToast, showError } = useToast();
  const [error, setError] = useState(null);
  const currency = user.defaultCurrency;
  // Usually cached already (the gig is open); from the Payments list it is fetched here.
  const { data: gig } = useQuery({ queryKey: queryKeys.gigs.detail(payment.gigId), queryFn: () => getGig(payment.gigId) });

  const remove = useMutation({
    mutationFn: () => deletePayment(payment.id),
    onSuccess: () => {
      invalidateMoneyData(queryClient);
      showToast({ message: 'Payment deleted' });
      onClose();
    },
    onError: (deleteError) => {
      if (isNetworkError(deleteError)) {
        showError(deleteError.message, { network: true });
      } else {
        setError(errorMessage(deleteError));
      }
    },
  });

  const amount = formatMoney(payment.amount, currency);
  return (
    <ConfirmDialog
      title="Delete this payment?"
      keepLabel="Keep payment"
      confirmLabel="Delete payment"
      pending={remove.isPending}
      error={error}
      onConfirm={() => remove.mutate()}
      onClose={onClose}
    >
      {amount} received on {formatDayShort(payment.receivedOn)} from {payment.clientName}.
      {gig &&
        ` “${payment.gigTitle}” will show ${formatMoney(addMoney(gig.outstanding, payment.amount), currency)} outstanding again.`}
    </ConfirmDialog>
  );
}
