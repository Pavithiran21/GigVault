import { useCallback, useId, useMemo, useRef, useState } from 'react';
import { useDismiss } from '../hooks/useDismiss';
import { PopoverContext } from './overlayContext';

/**
 * A small non-modal dialog under its button (the Dates filters and the custom period):
 * the first field gets focus, Esc or a click outside closes it, and Esc gives focus back to the
 * button. The content reads close and titleId with usePopover().
 *
 * trigger: ({ open, buttonProps }) => <button {...buttonProps}>…</button>
 */
export function Popover({ trigger, align = 'left', wide = false, children }) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const buttonRef = useRef(null);
  const panelRef = useRef(null);
  const refs = useMemo(() => [buttonRef, panelRef], []);

  const close = useCallback(({ returnFocus = true } = {}) => {
    setOpen(false);
    if (returnFocus) {
      buttonRef.current?.focus();
    }
  }, []);
  const closeQuietly = useCallback(() => close({ returnFocus: false }), [close]);
  useDismiss(refs, open, closeQuietly);
  const contextValue = useMemo(() => ({ close, titleId }), [close, titleId]);

  function toggle() {
    if (!open) {
      requestAnimationFrame(() => panelRef.current?.querySelector('input, select, button')?.focus());
    }
    setOpen(!open);
  }

  return (
    <div className="relative">
      {trigger({
        open,
        buttonProps: { ref: buttonRef, type: 'button', 'aria-haspopup': 'dialog', 'aria-expanded': open, onClick: toggle },
      })}
      {open && (
        <PopoverContext value={contextValue}>
          <div
            ref={panelRef}
            role="dialog"
            aria-labelledby={titleId}
            className={`card pad popover ${align === 'right' ? 'right' : ''} ${wide ? 'wide' : ''}`}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                close();
              }
            }}
          >
            {children}
          </div>
        </PopoverContext>
      )}
    </div>
  );
}
