import { IconPlus, IconSearch, IconUsers } from '@tabler/icons-react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { listClients } from '../../api/clients';
import { queryKeys } from '../../api/queryKeys';
import { useAuth } from '../../auth/AuthContext';
import { Pager } from '../../components/Pager';
import { EmptyPanel, ErrorPanel, Skeleton } from '../../components/StatePanels';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useSearchParamsState } from '../../hooks/useSearchParamsState';
import { plural } from '../../lib/enums';
import { formatMoney, toCents } from '../../lib/money';
import { ClientDialog } from './ClientDialog';

/**
 * Clients (UI-UX.md screen 11): search by name, A to Z, what each client owes. A click on a client
 * opens its view in a dialog (/clients/:id); ?new=1 opens Add client.
 */
export function ClientsPage() {
  usePageTitle('Clients');
  const { user } = useAuth();
  const { clientId } = useParams();
  const navigate = useNavigate();
  const { search } = useLocation();
  const [params, update] = useSearchParamsState(['q', 'page', 'new']);
  // The URL follows every key; the request waits until typing pauses.
  const q = useDebouncedValue(params.q, 300);
  const page = Number(params.page) || 1;

  const clientsQuery = useQuery({
    queryKey: queryKeys.clients.list({ q, page }),
    queryFn: () => listClients({ q, page }),
    placeholderData: keepPreviousData,
  });
  const data = clientsQuery.data;

  function openClient(id) {
    navigate(`/clients/${id}${search}`);
  }

  function closeDialog() {
    if (clientId) {
      navigate(`/clients${search}`);
    } else {
      update({ new: '', page: params.page });
    }
  }

  const noClientsAtAll = data && data.totalItems === 0 && !q;

  return (
    <>
      <div className="head">
        <h2>Clients</h2>
        <button type="button" className="btn btn-teal" onClick={() => update({ new: '1', page: params.page })}>
          <IconPlus size={18} aria-hidden="true" /> Add client
        </button>
      </div>

      {clientsQuery.isPending && <Skeleton className="card pad" label="Loading clients…" />}
      {clientsQuery.isError && (
        <ErrorPanel title="Couldn't load your clients" onRetry={() => clientsQuery.refetch()} />
      )}
      {noClientsAtAll && (
        <EmptyPanel
          icon={<IconUsers size={34} className="mx-auto text-teal-700" aria-hidden="true" />}
          title="No clients yet"
          text="Add the people and companies you work for. Each gig belongs to one client."
          action={
            <button type="button" className="btn btn-teal" onClick={() => update({ new: '1' })}>
              <IconPlus size={18} aria-hidden="true" /> Add client
            </button>
          }
        />
      )}
      {data && !noClientsAtAll && (
        <div className="card overflow-hidden">
          <div className="inp m-4 max-w-md">
            <IconSearch size={18} className="lead" aria-hidden="true" />
            <input
              type="search"
              placeholder="Search clients"
              aria-label="Search clients"
              maxLength={100}
              value={params.q}
              onChange={(event) => update({ q: event.target.value }, { replace: true })}
            />
          </div>
          <div className="scroll-x">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th className="text-right">Owes</th>
                </tr>
              </thead>
              <tbody>
                {data.items.length === 0 && (
                  <tr>
                    <td colSpan={2} className="muted">
                      No clients match this search.
                    </td>
                  </tr>
                )}
                {data.items.map((client) => (
                  <tr
                    key={client.id}
                    className="row-click"
                    onClick={(event) => {
                      if (!event.target.closest('a, button')) openClient(client.id);
                    }}
                  >
                    <td>
                      <Link className="name" to={`/clients/${client.id}${search}`}>
                        {client.name}
                      </Link>
                      <div className="muted text-xs">
                        {client.contactName ? `${client.contactName} · ` : ''}
                        {plural(client.gigCount, 'gig')}
                      </div>
                    </td>
                    <td className={`rs text-right ${toCents(client.owed) > 0n ? 'text-amber' : 'muted'}`}>
                      {formatMoney(client.owed, user.defaultCurrency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager data={data} note="A to Z" className="border-t border-line" onPage={(next) => update({ page: next })} />
        </div>
      )}

      {(clientId || params.new === '1') && (
        <ClientDialog key={clientId ?? 'new'} clientId={clientId ?? null} onClose={closeDialog} />
      )}
    </>
  );
}
