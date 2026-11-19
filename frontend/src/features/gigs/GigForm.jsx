import { zodResolver } from '@hookform/resolvers/zod';
import { IconBriefcase, IconCalendar, IconCalendarDue, IconUsers } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { listClients } from '../../api/clients';
import { createGig, updateGig } from '../../api/gigs';
import { invalidateMoneyData } from '../../api/invalidate';
import { queryKeys } from '../../api/queryKeys';
import { useAuth } from '../../auth/AuthContext';
import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { SelectField, TextField } from '../../components/Field';
import { ErrorPanel, Skeleton } from '../../components/StatePanels';
import { applyFieldErrors, errorMessage, isNetworkError } from '../../lib/apiErrors';
import { currencyIcon } from '../../lib/currencyIcon';
import { todayIn } from '../../lib/dates';
import { WORK_STATUSES } from '../../lib/enums';
import { cleanAmount } from '../../lib/money';
import { useToast } from '../../toast/ToastContext';
import { GIG_FIELDS, gigSchema } from './gigSchema';

/** The client picker's list: up to 100 clients, A to Z (FRONTEND.md "Limits"). */
const CLIENT_OPTIONS = { size: 100, sort: 'name' };

/** Work status as a radio group drawn as chips (pending, in progress, delivered). */
function WorkStatusChips({ register, error }) {
  return (
    <fieldset className="field mx-0 mt-0 border-0 p-0">
      <legend className="mb-1.5 text-sm font-semibold text-ink">Work status</legend>
      <div className="chips">
        {WORK_STATUSES.map((status) => (
          <label key={status.value} className="chip-radio m-0">
            <input type="radio" value={status.value} {...register('workStatus')} />
            <span className="chip">{status.label}</span>
          </label>
        ))}
      </div>
      {error && <div className="ferr">{error}</div>}
    </fieldset>
  );
}

/**
 * New gig and Edit gig, in the Gigs detail pane (UI-UX.md screen 9). Cancel goes back to the gig
 * (or the list, for a new gig). gig is null for a new one; defaultClientId comes from the
 * client filter, if one is set.
 *
 * The form appears once the clients have loaded: the client select is uncontrolled, so its
 * options must be there when it first gets its value.
 */
export function GigForm(props) {
  const clientsQuery = useQuery({
    queryKey: queryKeys.clients.list(CLIENT_OPTIONS),
    queryFn: () => listClients(CLIENT_OPTIONS),
  });
  if (clientsQuery.isPending) {
    return <Skeleton label="Opening the form…" />;
  }
  if (clientsQuery.isError) {
    return <ErrorPanel title="Couldn't load your clients" onRetry={() => clientsQuery.refetch()} />;
  }
  return <GigFormFields {...props} clients={clientsQuery.data.items} />;
}

function GigFormFields({ gig, clients, defaultClientId = '', onCancel, onSaved }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { showToast, showError } = useToast();
  const [formError, setFormError] = useState(null);
  const currency = user.defaultCurrency;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(gigSchema),
    defaultValues: gig
      ? {
          clientId: gig.clientId,
          title: gig.title,
          agreedAmount: gig.agreedAmount,
          startDate: gig.startDate,
          dueDate: gig.dueDate,
          workStatus: gig.workStatus,
        }
      : {
          clientId: defaultClientId,
          title: '',
          agreedAmount: '',
          startDate: todayIn(user.timeZone),
          dueDate: '',
          workStatus: 'pending',
        },
  });

  const save = useMutation({
    mutationFn: (values) => {
      const body = { ...values, agreedAmount: cleanAmount(values.agreedAmount) };
      return gig ? updateGig(gig.id, body) : createGig(body);
    },
    onSuccess: (saved) => {
      invalidateMoneyData(queryClient);
      showToast({ message: gig ? 'Changes saved' : 'Gig created' });
      onSaved(saved);
    },
    onError: (error) => {
      if (isNetworkError(error)) {
        showError(error.message, { network: true });
      } else if (!applyFieldErrors(error, setError, GIG_FIELDS)) {
        setFormError(errorMessage(error));
      }
    },
  });

  const noClients = clients.length === 0;

  return (
    <form
      noValidate
      className="max-w-[560px]"
      onSubmit={handleSubmit((values) => {
        setFormError(null);
        save.mutate(values);
      })}
    >
      <div className="muted text-[13px]">{gig ? `${gig.clientName} / ${gig.title} / Edit` : 'Gigs / New gig'}</div>
      <h2 className="mt-0.5 mb-3.5 text-[22px]">{gig ? 'Edit gig' : 'New gig'}</h2>
      {formError && (
        <Banner kind="err" className="mb-4">
          {formError}
        </Banner>
      )}
      {noClients ? (
        <div className="field">
          <span className="mb-1.5 block text-sm font-semibold text-ink">Client</span>
          <div className="banner b-info">
            <IconUsers size={18} aria-hidden="true" />
            <Link to="/clients?new=1" className="link">
              Add a client first
            </Link>
          </div>
        </div>
      ) : (
        <SelectField label="Client" icon={IconUsers} autoFocus error={errors.clientId?.message} {...register('clientId')}>
          {!gig && <option value="">Pick a client</option>}
          {gig && !clients.some((client) => client.id === gig.clientId) && (
            <option value={gig.clientId}>{gig.clientName}</option>
          )}
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </SelectField>
      )}
      <TextField label="Title" icon={IconBriefcase} maxLength={150} error={errors.title?.message} {...register('title')} />
      <TextField
        label="Agreed amount"
        icon={currencyIcon(currency)}
        suffix={currency}
        inputMode="decimal"
        autoComplete="off"
        error={errors.agreedAmount?.message}
        {...register('agreedAmount')}
      />
      <div className="grid grid-cols-2 gap-2.5 max-tab:grid-cols-1">
        <TextField label="Start" type="date" icon={IconCalendar} error={errors.startDate?.message} {...register('startDate')} />
        <TextField label="Due" type="date" icon={IconCalendarDue} error={errors.dueDate?.message} {...register('dueDate')} />
      </div>
      <WorkStatusChips register={register} error={errors.workStatus?.message} />
      <div className="flex gap-2">
        <button type="button" className="btn btn-line flex-1" onClick={onCancel}>
          Cancel
        </button>
        <Button type="submit" className="btn btn-teal flex-1" pending={save.isPending} disabled={noClients}>
          {gig ? 'Save changes' : 'Create gig'}
        </Button>
      </div>
    </form>
  );
}
