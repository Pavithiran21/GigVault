import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';

/** "1–4 of 6 · A to Z" with previous and next page buttons, under every paginated list. */
export function Pager({ data, onPage, note, className = '' }) {
  if (!data || data.totalItems === 0) {
    return null;
  }
  const first = (data.page - 1) * data.size + 1;
  const last = Math.min(data.page * data.size, data.totalItems);
  return (
    <nav className={`pager ${className}`} aria-label="Pages">
      <span>
        {first}–{last} of {data.totalItems}
        {note ? ` · ${note}` : ''}
      </span>
      <span>
        <button
          type="button"
          className="icon-btn"
          aria-label="Previous page"
          disabled={data.page <= 1}
          onClick={() => onPage(data.page - 1)}
        >
          <IconChevronLeft size={18} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label="Next page"
          disabled={data.page >= data.totalPages}
          onClick={() => onPage(data.page + 1)}
        >
          <IconChevronRight size={18} aria-hidden="true" />
        </button>
      </span>
    </nav>
  );
}
