import { useId } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { Pager } from '../../components/Pager';
import { ErrorPanel, Skeleton } from '../../components/StatePanels';
import { PaymentTag } from '../../components/StatusTag';
import { useListboxKeys } from '../../hooks/useListboxKeys';
import { formatDayShort } from '../../lib/dates';
import { formatMoney, shareOf } from '../../lib/money';

/**
 * The gig list (UI-UX.md "Gigs screen"): a listbox, so Up and Down move through the gigs and
 * Enter opens one. Each row: title, client and due date, payment tag, agreed amount, progress.
 */
export function GigList({ query, selectedId, hasFilters, onSelect, onPage, onClearFilters }) {
  const { user } = useAuth();
  const listId = useId();
  const items = query.data?.items ?? [];
  const { activeIndex, setActiveIndex, onKeyDown } = useListboxKeys({
    optionCount: items.length,
    isOpen: true,
    onPick: (index) => onSelect(items[index].id),
    onClose: () => setActiveIndex(-1),
  });
  const optionId = (id) => `${listId}-${id}`;
  const active = items[activeIndex];

  if (query.isPending) {
    return <Skeleton className="p-4" label="Loading gigs…" lines={6} />;
  }
  if (query.isError) {
    return <ErrorPanel className="m-3.5" title="Couldn't load your gigs" onRetry={() => query.refetch()} />;
  }
  if (items.length === 0) {
    return (
      <div className="p-6 text-center">
        {hasFilters ? (
          <>
            <b className="text-ink">No gigs match these filters.</b>
            <div className="mt-2">
              <button type="button" className="link" onClick={onClearFilters}>
                Clear filters
              </button>
            </div>
          </>
        ) : (
          <>
            <b className="text-ink">No gigs yet.</b>
            <div className="muted text-sm">Add a client, then your first gig.</div>
          </>
        )}
      </div>
    );
  }

  return (
    <>
      <div
        role="listbox"
        aria-label="Gigs"
        tabIndex={0}
        className="listbox outline-none"
        aria-activedescendant={active ? optionId(active.id) : undefined}
        onKeyDown={onKeyDown}
        onFocus={(event) => {
          // Keyboard focus only: a mouse click on a row shouldn't draw the keyboard ring.
          const byKeyboard = event.currentTarget.matches(':focus-visible');
          if (byKeyboard && (activeIndex < 0 || activeIndex >= items.length)) {
            const selectedIndex = items.findIndex((gig) => gig.id === selectedId);
            setActiveIndex(Math.max(selectedIndex, 0));
          }
        }}
        onBlur={() => setActiveIndex(-1)}
      >
        {items.map((gig, index) => (
          <div
            key={gig.id}
            id={optionId(gig.id)}
            role="option"
            aria-selected={gig.id === selectedId}
            className={`gig ${gig.id === selectedId ? 'on' : ''} ${index === activeIndex ? 'active-key' : ''}`}
            onClick={() => onSelect(gig.id)}
          >
            <div className="min-w-0">
              <b className="block truncate">{gig.title}</b>
              <small className="block truncate">
                {gig.clientName} · {gig.workStatus === 'delivered' ? 'delivered' : `due ${formatDayShort(gig.dueDate)}`}
              </small>
            </div>
            <div className="text-right">
              <PaymentTag status={gig.paymentStatus} />
              <br />
              <small className="rs text-[13px]">{formatMoney(gig.agreedAmount, user.defaultCurrency)}</small>
            </div>
            <div className="bar2" aria-hidden="true">
              <span style={{ width: `${shareOf(gig.receivedAmount, gig.agreedAmount)}%` }} />
            </div>
          </div>
        ))}
      </div>
      <Pager data={query.data} onPage={onPage} />
    </>
  );
}
