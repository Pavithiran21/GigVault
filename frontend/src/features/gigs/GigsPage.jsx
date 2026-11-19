import { IconBriefcase, IconDownload, IconPlus, IconSearch } from '@tabler/icons-react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { getGig, listGigs } from '../../api/gigs';
import { queryKeys } from '../../api/queryKeys';
import { Button } from '../../components/Button';
import { ErrorPanel, Skeleton } from '../../components/StatePanels';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { DESKTOP_QUERY, PHONE_QUERY, useMediaQuery } from '../../hooks/useMediaQuery';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useSearchParamsState } from '../../hooks/useSearchParamsState';
import { PAYMENT_STATUSES, WORK_STATUSES } from '../../lib/enums';
import { useCsvExport } from '../export/useCsvExport';
import { ChoiceFilterMenu, ClientFilterMenu, DatesFilter } from '../filters/FilterChips';
import { GigDetail, GigNotFound } from './GigDetail';
import { GigForm } from './GigForm';
import { GigList } from './GigList';

const FILTER_KEYS = ['q', 'paymentStatus', 'workStatus', 'clientId', 'from', 'to', 'page'];

/** Edit gig: the form, once the gig has loaded. */
function GigEditPane({ gigId, onCancel, onSaved }) {
  const gigQuery = useQuery({ queryKey: queryKeys.gigs.detail(gigId), queryFn: () => getGig(gigId) });
  if (gigQuery.isPending) {
    return <Skeleton label="Opening gig…" />;
  }
  if (gigQuery.isError) {
    return gigQuery.error.status === 404 ? (
      <GigNotFound />
    ) : (
      <ErrorPanel title="Couldn't load this gig" onRetry={() => gigQuery.refetch()} />
    );
  }
  return <GigForm gig={gigQuery.data} onCancel={onCancel} onSaved={onSaved} />;
}

/**
 * Gigs (UI-UX.md screen 7): the filtered list beside the gig on desktop (stacked on a tablet).
 * On a phone the list comes first, and a gig opens full screen with a back arrow.
 * The pane shows /gigs/:id (view), /gigs/new or /gigs/:id/edit; on desktop with no gig chosen
 * it shows the first gig of the list, so it is never empty.
 */
export function GigsPage() {
  usePageTitle('Gigs');
  const { gigId } = useParams();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const isPhone = useMediaQuery(PHONE_QUERY);
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const [filters, update] = useSearchParamsState(FILTER_KEYS);
  const { exportCsv, pending: exporting } = useCsvExport();
  const paneRef = useRef(null);

  const mode = pathname.endsWith('/new') ? 'new' : pathname.endsWith('/edit') ? 'edit' : 'view';

  // On a tablet the pane sits under the list: bring the gig (or its form) into view when it opens.
  useEffect(() => {
    const stacked = !isPhone && !isDesktop;
    if (stacked && (gigId || mode === 'new')) {
      paneRef.current?.scrollIntoView({ block: 'start' });
    }
  }, [gigId, mode, isPhone, isDesktop]);
  // The URL follows every key; the request waits until typing pauses.
  const q = useDebouncedValue(filters.q, 300);
  const filterParams = {
    q,
    paymentStatus: filters.paymentStatus,
    workStatus: filters.workStatus,
    clientId: filters.clientId,
    from: filters.from,
    to: filters.to,
  };
  const listParams = { ...filterParams, page: Number(filters.page) || 1 };
  const gigsQuery = useQuery({
    queryKey: queryKeys.gigs.list(listParams),
    queryFn: () => listGigs(listParams),
    placeholderData: keepPreviousData,
  });

  const hasFilters = FILTER_KEYS.some((key) => key !== 'page' && filters[key]);
  const shownId = gigId ?? (isPhone ? null : gigsQuery.data?.items[0]?.id);
  const paneOpen = mode !== 'view' || Boolean(gigId);

  const toGig = (id) => navigate(`/gigs/${id}${search}`);
  const toList = () => navigate(`/gigs${search}`);
  const clearFilters = () => update(Object.fromEntries(FILTER_KEYS.map((key) => [key, ''])));

  let pane;
  if (mode === 'new') {
    pane = <GigForm defaultClientId={filters.clientId} onCancel={toList} onSaved={(gig) => toGig(gig.id)} />;
  } else if (mode === 'edit') {
    pane = <GigEditPane gigId={gigId} onCancel={() => toGig(gigId)} onSaved={(gig) => toGig(gig.id)} />;
  } else if (shownId) {
    pane = (
      <GigDetail
        key={shownId}
        gigId={shownId}
        onEdit={() => navigate(`/gigs/${shownId}/edit${search}`)}
        onDeleted={() => navigate(`/gigs${search}`, { replace: true })}
        onBack={isPhone ? toList : undefined}
      />
    );
  } else {
    pane = (
      <div className="muted grid h-full place-items-center p-10 text-center text-sm">
        <div>
          <IconBriefcase size={32} className="mx-auto text-teal-700" aria-hidden="true" />
          <p>Pick a gig to see its payments and files.</p>
        </div>
      </div>
    );
  }

  // Phone, with a gig (or its form) open: the gig full screen, no list.
  if (isPhone && paneOpen) {
    return <div className="card detail">{pane}</div>;
  }

  const list = (
    <div className="list">
      <div className="filters">
        <div className="flex gap-2">
          <div className="inp flex-1">
            <IconSearch size={18} className="lead" aria-hidden="true" />
            <input
              type="search"
              placeholder="Search gigs"
              aria-label="Search gigs"
              maxLength={100}
              value={filters.q}
              onChange={(event) => update({ q: event.target.value }, { replace: true })}
            />
          </div>
          <Button
            className="btn btn-line"
            style={{ padding: '8px 11px', fontSize: 14 }}
            aria-label="Export these gigs as CSV"
            pending={exporting}
            onClick={() => exportCsv(filterParams)}
          >
            {!exporting && <IconDownload size={18} aria-hidden="true" />} CSV
          </Button>
        </div>
        <div className="chips">
          <ChoiceFilterMenu
            name="Payment"
            value={filters.paymentStatus}
            options={PAYMENT_STATUSES}
            onChange={(value) => update({ paymentStatus: value })}
          />
          <ChoiceFilterMenu
            name="Work"
            value={filters.workStatus}
            options={WORK_STATUSES}
            onChange={(value) => update({ workStatus: value })}
          />
          <ClientFilterMenu value={filters.clientId} onChange={(value) => update({ clientId: value })} />
          <DatesFilter
            from={filters.from}
            to={filters.to}
            title="Gigs running between"
            description="Shows every gig that overlaps these dates: started on or before To, due on or after From."
            onChange={(range) => update(range)}
          />
          {hasFilters && (
            <button type="button" className="link ml-0.5 text-[13px]" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>
      </div>
      <GigList
        query={gigsQuery}
        selectedId={shownId}
        hasFilters={hasFilters}
        onSelect={toGig}
        onPage={(page) => update({ page })}
        onClearFilters={clearFilters}
      />
    </div>
  );

  return (
    <>
      <div className="head">
        <h2>Gigs</h2>
        <button type="button" className="btn btn-teal" onClick={() => navigate(`/gigs/new${search}`)}>
          <IconPlus size={18} aria-hidden="true" /> New gig
        </button>
      </div>
      {isPhone ? (
        <div className="split">{list}</div>
      ) : (
        <div className="split">
          {list}
          <div ref={paneRef} className="detail">
            {pane}
          </div>
        </div>
      )}
    </>
  );
}
