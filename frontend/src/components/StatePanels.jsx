import { IconCloudOff, IconRefresh } from '@tabler/icons-react';

/** Loading: a few shimmering lines, with words a screen reader reads out. */
export function Skeleton({ label = 'Loading…', lines = 3, className = '' }) {
  return (
    <div className={className} role="status">
      <div className="muted text-[13px]">{label}</div>
      <div className="skel" style={{ width: '50%', height: 20 }} />
      {Array.from({ length: lines - 1 }, (_, index) => (
        <div key={index} className="skel" style={{ width: index % 2 ? '70%' : '100%' }} />
      ))}
    </div>
  );
}

/** A list or page that couldn't load; "Try again" runs the query again (UI-UX.md "States"). */
export function ErrorPanel({
  title = "Couldn't load this",
  message = 'Check your connection and try again.',
  onRetry,
  className = '',
}) {
  return (
    <div className={`card pad ${className}`} role="alert">
      <div className="flex gap-3">
        <IconCloudOff size={22} className="shrink-0 text-red" aria-hidden="true" />
        <div>
          <b className="text-ink">{title}</b>
          <div className="muted text-sm">{message}</div>
          {onRetry && (
            <button type="button" className="btn btn-line mt-2.5" onClick={onRetry}>
              <IconRefresh size={18} aria-hidden="true" /> Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** An empty list: an icon, a title, one line and the action that fills it. */
export function EmptyPanel({ icon, title, text, action, className = '' }) {
  return (
    <div className={`card pad text-center ${className}`}>
      {icon}
      <h3 className="mt-2 mb-1 text-[18px]">{title}</h3>
      <p className="muted mt-0 mb-3.5 text-sm">{text}</p>
      {action}
    </div>
  );
}
