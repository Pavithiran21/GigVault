import { useRef } from 'react';
import { DateRangeForm, FIVE_YEARS_DAYS } from '../../components/DateRangeForm';
import { Popover } from '../../components/Popover';

/**
 * Month, Year or Custom (UI-UX.md screens 5 and 6), as a tablist: Left and Right move between the
 * tabs, Enter or Space picks one. Custom opens From and To; the period changes only on Apply.
 * panelId is the hero the tabs control.
 */
export function PeriodSwitch({ period, from, to, panelId, onChange }) {
  const listRef = useRef(null);

  function onKeyDown(event) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }
    event.preventDefault();
    const tabs = [...listRef.current.querySelectorAll('[role="tab"]')];
    const index = tabs.indexOf(document.activeElement);
    const next = (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    tabs[next].focus();
  }

  const tabProps = (value, className) => ({
    className,
    id: `period-${value}`,
    role: 'tab',
    type: 'button',
    'aria-selected': period === value,
    'aria-controls': panelId,
    tabIndex: period === value ? 0 : -1,
  });

  return (
    <div ref={listRef} className="seg" role="tablist" aria-label="Period" onKeyDown={onKeyDown}>
      <button {...tabProps('month', 'sep first')} onClick={() => onChange({ period: 'month', from: '', to: '' })}>
        Month
      </button>
      <button {...tabProps('year', 'sep')} onClick={() => onChange({ period: '', from: '', to: '' })}>
        Year
      </button>
      <Popover
        align="right"
        wide
        trigger={({ buttonProps }) => (
          <button {...buttonProps} {...tabProps('custom', 'last')}>
            Custom
          </button>
        )}
      >
        <DateRangeForm
          title="Custom period"
          description="Up to 5 years. The chart shows one point per month."
          from={from}
          to={to}
          maxDays={FIVE_YEARS_DAYS}
          sideBySide
          secondaryLabel="Cancel"
          onApply={(range) => onChange({ period: 'custom', ...range })}
        />
      </Popover>
    </div>
  );
}
