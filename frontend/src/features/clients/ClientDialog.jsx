import { zodResolver } from '@hookform/resolvers/zod';
import {
  IconBuilding,
  IconFileSearch,
  IconMail,
  IconPencil,
  IconTrash,
  IconUser,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { createClient, deleteClient, getClient, updateClient } from '../../api/clients';
import { invalidateMoneyData } from '../../api/invalidate';
import { queryKeys } from '../../api/queryKeys';
import { useAuth } from '../../auth/AuthContext';
import { ClientAvatar } from '../../components/Avatar';
import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { TextAreaField, TextField } from '../../components/Field';
import { Skeleton } from '../../components/StatePanels';
import { applyFieldErrors, errorMessage, isNetworkError } from '../../lib/apiErrors';
import { timestampMonthYear } from '../../lib/dates';
import { formatMoney, toCents } from '../../lib/money';
import { useToast } from '../../toast/ToastContext';
import { CLIENT_FIELDS, clientFormValues, clientSchema } from './clientSchema';
import { ClientInUseDialog, DeleteClientDialog } from './DeleteClientDialogs';

/** The read-only client view (UI-UX.md screen 12): details, three tiles, Delete, See gigs and Edit. */
function ClientView({ client, titleId, onClose, onEdit, onDelete }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const owes = toCents(client.owed) > 0n;
  return (
    <>
      <div className="mb-3.5 flex items-start gap-2.5">
        <ClientAvatar id={client.id} name={client.name} />
        <div className="min-w-0 flex-1">
          <h3 id={titleId} className="m-0 break-words">
            {client.name}
          </h3>
          <span className="muted text-[13px]">Client since {timestampMonthYear(client.createdAt, user.timeZone)}</span>
        </div>
        <button type="button" className="icon-btn sm" aria-label="Close" onClick={onClose}>
          <IconX size={16} aria-hidden="true" />
        </button>
      </div>
      {(client.contactName || client.contactEmail || client.notes) && (
        <dl className="dl">
          {client.contactName && (
            <>
              <dt>Contact</dt>
              <dd>{client.contactName}</dd>
            </>
          )}
          {client.contactEmail && (
            <>
              <dt>Email</dt>
              <dd>
                <a className="link" href={`mailto:${client.contactEmail}`}>
                  {client.contactEmail}
                </a>
              </dd>
            </>
          )}
          {client.notes && (
            <>
              <dt>Notes</dt>
              <dd className="whitespace-pre-wrap">{client.notes}</dd>
            </>
          )}
        </dl>
      )}
      <div className="ledger client-ledger">
        <div>
          <small>Gigs</small>
          <span className="rs">{client.gigCount}</span>
        </div>
        <div>
          <small>Payments</small>
          <span className="rs">{client.paymentCount}</span>
        </div>
        <div>
          <small>Owes you</small>
          <span className={`rs ${owes ? 'text-amber' : 'muted'}`}>{formatMoney(client.owed, user.defaultCurrency)}</span>
        </div>
      </div>
      <div className="acts flex-wrap" style={{ justifyContent: 'space-between' }}>
        <button type="button" className="btn btn-danger-line" onClick={onDelete}>
          <IconTrash size={18} aria-hidden="true" /> Delete
        </button>
        <span className="flex gap-2">
          <button type="button" className="btn btn-line" onClick={() => navigate(`/gigs?clientId=${client.id}`)}>
            See gigs
          </button>
          {/* autoFocus: back from the form (Cancel), focus lands on Edit again. */}
          <button type="button" className="btn btn-teal" autoFocus onClick={onEdit}>
            <IconPencil size={18} aria-hidden="true" /> Edit
          </button>
        </span>
      </div>
    </>
  );
}

/** Add client or Edit client (UI-UX.md screen 13). */
function ClientForm({ client, titleId, onCancel, onSaved }) {
  const queryClient = useQueryClient();
  const { showToast, showError } = useToast();
  const [formError, setFormError] = useState(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({ resolver: zodResolver(clientSchema), defaultValues: clientFormValues(client) });

  const save = useMutation({
    mutationFn: (values) => (client ? updateClient(client.id, values) : createClient(values)),
    onSuccess: (saved) => {
      queryClient.setQueryData(queryKeys.clients.detail(saved.id), saved);
      invalidateMoneyData(queryClient);
      showToast({ message: client ? 'Changes saved' : 'Client added' });
      onSaved(saved);
    },
    onError: (error) => {
      if (isNetworkError(error)) {
        showError(error.message, { network: true });
      } else if (!applyFieldErrors(error, setError, CLIENT_FIELDS)) {
        setFormError(errorMessage(error));
      }
    },
  });

  return (
    <form
      noValidate
      onSubmit={handleSubmit((values) => {
        setFormError(null);
        save.mutate(values);
      })}
    >
      <h3 id={titleId} className="mb-4">
        {client ? 'Edit client' : 'Add client'}
      </h3>
      {formError && (
        <Banner kind="err" className="mb-4">
          {formError}
        </Banner>
      )}
      <TextField
        label="Name"
        icon={IconBuilding}
        maxLength={120}
        autoFocus
        error={errors.name?.message}
        {...register('name')}
      />
      <TextField
        label="Contact name"
        optional
        icon={IconUser}
        maxLength={120}
        error={errors.contactName?.message}
        {...register('contactName')}
      />
      <TextField
        label="Contact email"
        optional
        type="email"
        icon={IconMail}
        error={errors.contactEmail?.message}
        {...register('contactEmail')}
      />
      <TextAreaField label="Notes" optional maxLength={2000} error={errors.notes?.message} {...register('notes')} />
      <div className="acts">
        <button type="button" className="btn btn-line" onClick={onCancel}>
          Cancel
        </button>
        <Button type="submit" className="btn btn-teal" pending={save.isPending}>
          Save client
        </Button>
      </div>
    </form>
  );
}

function ClientNotFound({ titleId, onClose }) {
  return (
    <div className="text-center">
      <IconFileSearch size={40} className="mx-auto text-teal-700" aria-hidden="true" />
      <h3 id={titleId} className="mt-2">
        Client not found
      </h3>
      <p className="muted mt-0 mb-3.5 text-sm">It may have been deleted, or the link is wrong.</p>
      <button type="button" className="btn btn-line" onClick={onClose}>
        Back to clients
      </button>
    </div>
  );
}

/**
 * One dialog for a client: the read-only view first (a click on a client opens this), Edit
 * switches the same dialog to the form, and Cancel goes back to the view. With no clientId it
 * opens straight on the Add client form.
 */
export function ClientDialog({ clientId, onClose }) {
  const titleId = useId();
  const queryClient = useQueryClient();
  const { showToast, showError } = useToast();
  const [mode, setMode] = useState(clientId ? 'view' : 'new');
  const [deleteStep, setDeleteStep] = useState(null); // null, 'confirm' or 'in-use'
  const [deleteError, setDeleteError] = useState(null);

  const clientQuery = useQuery({
    queryKey: queryKeys.clients.detail(clientId),
    queryFn: () => getClient(clientId),
    enabled: Boolean(clientId),
  });
  const client = clientQuery.data;

  const remove = useMutation({
    mutationFn: () => deleteClient(clientId),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: queryKeys.clients.detail(clientId) });
      invalidateMoneyData(queryClient);
      showToast({ message: 'Client deleted' });
      onClose();
    },
    onError: async (error) => {
      if (error.code === 'CLIENT_IN_USE') {
        // A gig was added meanwhile: show the counts as they are now.
        await clientQuery.refetch();
        setDeleteStep('in-use');
      } else if (isNetworkError(error)) {
        showError(error.message, { network: true });
      } else {
        setDeleteError(errorMessage(error));
      }
    },
  });

  function startDelete() {
    setDeleteError(null);
    // No point asking "Delete …?" for a client the server would refuse.
    setDeleteStep(client.gigCount > 0 ? 'in-use' : 'confirm');
  }

  let content;
  if (mode === 'new') {
    content = <ClientForm titleId={titleId} onCancel={onClose} onSaved={onClose} />;
  } else if (clientQuery.isPending) {
    content = <Skeleton label="Opening client…" />;
  } else if (clientQuery.isError) {
    content =
      clientQuery.error.status === 404 ? (
        <ClientNotFound titleId={titleId} onClose={onClose} />
      ) : (
        <Banner kind="err">{errorMessage(clientQuery.error) ?? "Couldn't load this client."}</Banner>
      );
  } else if (mode === 'edit') {
    content = (
      <ClientForm client={client} titleId={titleId} onCancel={() => setMode('view')} onSaved={() => setMode('view')} />
    );
  } else {
    content = (
      <ClientView
        client={client}
        titleId={titleId}
        onClose={onClose}
        onEdit={() => setMode('edit')}
        onDelete={startDelete}
      />
    );
  }

  return (
    <>
      <Dialog labelledBy={titleId} onClose={onClose} wide>
        {content}
      </Dialog>
      {deleteStep === 'confirm' && client && (
        <DeleteClientDialog
          client={client}
          pending={remove.isPending}
          error={deleteError}
          onConfirm={() => remove.mutate()}
          onClose={() => setDeleteStep(null)}
        />
      )}
      {deleteStep === 'in-use' && client && <ClientInUseDialog client={client} onClose={() => setDeleteStep(null)} />}
    </>
  );
}
