import { zodResolver } from '@hookform/resolvers/zod';
import { IconBriefcase, IconBuildingBank, IconCalendar } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { invalidateMoneyData } from '../../api/invalidate';
import { recordPayment } from '../../api/payments';
import { queryKeys } from '../../api/queryKeys';
import { useAuth } from '../../auth/AuthContext';
import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { SelectField, TextField } from '../../components/Field';
import { applyFieldErrors, errorMessage, isNetworkError } from '../../lib/apiErrors';
import { currencyIcon } from '../../lib/currencyIcon';
import { todayIn } from '../../lib/dates';
import { PAYMENT_METHODS } from '../../lib/enums';
import { cleanAmount, formatMoney, toCents } from '../../lib/money';
import { useToast } from '../../toast/ToastContext';
import { PAYMENT_FIELDS, paymentSchema } from './paymentSchema';

/**
 * Record payment (UI-UX.md screen 10): a centred dialog, a bottom sheet on a phone.
 * gigs: the gig being paid, or (from the phone's Earnings) every owed gig, to pick from.
 * The backend refuses more than is owed, even when two payments race (BACKEND.md).
 */
export function RecordPaymentDialog({ gigs, onClose }) {
  const titleId = useId();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { showToast, showError } = useToast();
  const [formError, setFormError] = useState(null);
  const today = todayIn(user.timeZone);
  const currency = user.defaultCurrency;

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(paymentSchema(today)),
    defaultValues: { gigId: gigs[0].id, amount: '', receivedOn: today, method: 'bank_transfer' },
  });
  const gigId = useWatch({ control, name: 'gigId' });
  const gig = gigs.find((item) => item.id === gigId) ?? gigs[0];

  const save = useMutation({
    mutationFn: (values) =>
      recordPayment(values.gigId, {
        amount: cleanAmount(values.amount),
        receivedOn: values.receivedOn,
        method: values.method,
      }),
    onSuccess: ({ gig: updated }) => {
      // The answer holds the gig's new totals: show them at once, with the toast, while every
      // list that shows money refetches in the background.
      queryClient.setQueryData(queryKeys.gigs.detail(updated.id), (old) =>
        old ? { ...old, ...updated, paymentCount: old.paymentCount + 1 } : old,
      );
      invalidateMoneyData(queryClient);
      const left = toCents(updated.outstanding) === 0n ? 'paid in full' : `${formatMoney(updated.outstanding, currency)} left`;
      showToast({ message: `Payment saved · ${left}` });
      onClose();
    },
    onError: (error) => {
      if (isNetworkError(error)) {
        showError(error.message, { network: true });
      } else if (!applyFieldErrors(error, setError, PAYMENT_FIELDS)) {
        setFormError(errorMessage(error));
      }
    },
  });

  return (
    <Dialog labelledBy={titleId} onClose={onClose}>
      <form
        noValidate
        onSubmit={handleSubmit((values) => {
          setFormError(null);
          save.mutate(values);
        })}
      >
        <h3 id={titleId}>Record payment</h3>
        {gigs.length === 1 ? (
          <p className="muted mt-0 mb-4 text-sm">
            {gig.title} · {formatMoney(gig.outstanding, currency)} still owed
          </p>
        ) : (
          <div className="mt-3">
            <SelectField label="Gig" icon={IconBriefcase} {...register('gigId')}>
              {gigs.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title} · {formatMoney(item.outstanding, currency)} owed
                </option>
              ))}
            </SelectField>
          </div>
        )}
        {formError && (
          <Banner kind="err" className="mb-4">
            {formError}
          </Banner>
        )}
        <TextField
          label="Amount"
          icon={currencyIcon(currency)}
          suffix={currency}
          inputMode="decimal"
          autoComplete="off"
          autoFocus
          error={errors.amount?.message}
          {...register('amount')}
        />
        <button
          type="button"
          className="btn btn-soft btn-sm -mt-1.5 mb-3.5"
          onClick={() => setValue('amount', gig.outstanding, { shouldValidate: true })}
        >
          Use full amount
        </button>
        <TextField
          label="Received on"
          type="date"
          icon={IconCalendar}
          max={today}
          hint="Today or earlier, in your time zone."
          error={errors.receivedOn?.message}
          {...register('receivedOn')}
        />
        <SelectField label="Method" icon={IconBuildingBank} error={errors.method?.message} {...register('method')}>
          {PAYMENT_METHODS.map((method) => (
            <option key={method.value} value={method.value}>
              {method.label}
            </option>
          ))}
        </SelectField>
        <div className="acts">
          <button type="button" className="btn btn-line" onClick={onClose}>
            Cancel
          </button>
          <Button type="submit" className="btn btn-teal" pending={save.isPending}>
            Save payment
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
