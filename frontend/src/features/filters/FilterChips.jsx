import { IconCalendar, IconCheck, IconChevronDown, IconSearch, IconUsers } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { getClient, listClients } from '../../api/clients';
import { queryKeys } from '../../api/queryKeys';
import { DateRangeForm } from '../../components/DateRangeForm';
import { Menu, MenuItem } from '../../components/Menu';
import { Popover } from '../../components/Popover';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { rangeLabel } from '../../lib/dates';

// The filter chips of Gigs and Payments (UI-UX.md screen 8). A chip is filled teal while its
// filter is set. Menus are role="menu" with menuitemradio options.

/** "Payment: All ▾" or "Work: In progress ▾". options: [{ value, label, tagClass? }]. */
export function ChoiceFilterMenu({ name, value, options, onChange }) {
  const current = options.find((option) => option.value === value);
  return (
    <Menu
      label={`${name} status`}
      trigger={({ buttonProps }) => (
        <button {...buttonProps} className={`chip ${current ? 'on' : ''}`}>
          {name}: {current ? current.label : 'All'} <IconChevronDown size={14} aria-hidden="true" />
        </button>
      )}
      header={<small>{name}</small>}
    >
      <MenuItem checked={!current} onSelect={() => onChange('')}>
        All {!current && <IconCheck size={16} className="tick" aria-hidden="true" />}
      </MenuItem>
      {options.map((option) => (
        <MenuItem key={option.value} checked={option.value === value} onSelect={() => onChange(option.value)}>
          <span className={`st ${option.tagClass ?? 's-work'}`}>{option.label}</span>
          {option.value === value && <IconCheck size={16} className="tick" aria-hidden="true" />}
        </MenuItem>
      ))}
    </Menu>
  );
}

/** The client's name for the chip, when the filter came from a link ("See gigs"). */
function useClientName(clientId) {
  const { data } = useQuery({
    queryKey: queryKeys.clients.detail(clientId),
    queryFn: () => getClient(clientId),
    enabled: Boolean(clientId),
  });
  return data?.name;
}

/** "Client ▾" with "Find a client" and the clients A to Z (up to 100 that match). */
export function ClientFilterMenu({ value, onChange }) {
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search, 250);
  const params = { q, size: 100, sort: 'name' };
  const clientsQuery = useQuery({ queryKey: queryKeys.clients.list(params), queryFn: () => listClients(params) });
  const name = useClientName(value);

  return (
    <Menu
      label="Client"
      trigger={({ buttonProps }) => (
        <button {...buttonProps} className={`chip ${value ? 'on' : ''}`}>
          <IconUsers size={14} aria-hidden="true" /> {value ? (name ?? 'Client') : 'Client'}{' '}
          <IconChevronDown size={14} aria-hidden="true" />
        </button>
      )}
      header={
        <>
          <small>Client</small>
          <div className="inp mx-1 mt-1 mb-1.5">
            <IconSearch size={18} className="lead" aria-hidden="true" />
            <input
              type="search"
              placeholder="Find a client"
              aria-label="Find a client"
              data-menu-start
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </>
      }
    >
      <div className="menu-scroll">
        <MenuItem checked={!value} onSelect={() => onChange('')}>
          All clients {!value && <IconCheck size={16} className="tick" aria-hidden="true" />}
        </MenuItem>
        {clientsQuery.data?.items.map((client) => (
          <MenuItem key={client.id} checked={client.id === value} onSelect={() => onChange(client.id)}>
            <span className="truncate">{client.name}</span>
            {client.id === value && <IconCheck size={16} className="tick" aria-hidden="true" />}
          </MenuItem>
        ))}
        {clientsQuery.data?.items.length === 0 && <p className="muted m-0 px-2.5 py-2 text-sm">No client matches.</p>}
      </div>
    </Menu>
  );
}

/** The Dates chip: "Oct 2026" or "1 Oct – 15 Oct 2026" once set, with From/To in a popover. */
export function DatesFilter({ from, to, title, description, onChange }) {
  const isSet = Boolean(from && to);
  return (
    <Popover
      trigger={({ buttonProps }) => (
        <button {...buttonProps} className={`chip ${isSet ? 'on' : ''}`}>
          <IconCalendar size={14} aria-hidden="true" /> {isSet ? rangeLabel(from, to) : 'Dates'}
        </button>
      )}
    >
      <DateRangeForm
        title={title}
        description={description}
        from={from}
        to={to}
        secondaryLabel="Clear"
        onSecondary={() => onChange({ from: '', to: '' })}
        onApply={onChange}
      />
    </Popover>
  );
}
