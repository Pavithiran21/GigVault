import { useCallback, useId, useMemo, useRef, useState } from 'react';
import { useDismiss } from '../hooks/useDismiss';
import { useMenuKeys } from '../hooks/useMenuKeys';
import { MenuContext, useMenu } from './overlayContext';

/**
 * A button that opens a role="menu" (the account menu and the filter menus; UI-UX.md "Keyboard").
 * Opening focuses the first item, or the element marked data-menu-start (such as "Find a client",
 * where Down moves into the items). Esc, Tab and picking an item close it and focus the button
 * again; a click outside just closes it.
 *
 * trigger: ({ open, buttonProps }) => <button {...buttonProps}>…</button>
 * header: content above the role="menu" list (the name and email, a search field).
 * children: the items, as <MenuItem>.
 */
export function Menu({ label, align = 'left', trigger, header, children }) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const buttonRef = useRef(null);
  const panelRef = useRef(null);
  const listRef = useRef(null);
  const refs = useMemo(() => [buttonRef, panelRef], []);

  const close = useCallback(({ returnFocus = true } = {}) => {
    setOpen(false);
    if (returnFocus) {
      buttonRef.current?.focus();
    }
  }, []);
  const closeQuietly = useCallback(() => close({ returnFocus: false }), [close]);
  useDismiss(refs, open, closeQuietly);
  const { onKeyDown, focusFirst } = useMenuKeys(listRef, close);
  const contextValue = useMemo(() => ({ close }), [close]);

  function toggle() {
    if (!open) {
      // After the panel has rendered.
      requestAnimationFrame(() => {
        const start = panelRef.current?.querySelector('[data-menu-start]');
        if (start) {
          start.focus();
        } else {
          focusFirst();
        }
      });
    }
    setOpen(!open);
  }

  // Keys in the header (the client search): Down moves into the items, Esc closes.
  function onHeaderKeyDown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusFirst();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  }

  const buttonProps = {
    ref: buttonRef,
    type: 'button',
    'aria-haspopup': 'menu',
    'aria-expanded': open,
    'aria-controls': open ? menuId : undefined,
    onClick: toggle,
  };

  return (
    <div className="relative">
      {trigger({ open, buttonProps })}
      {open && (
        <MenuContext value={contextValue}>
          <div ref={panelRef} className={`menu menu-pop ${align === 'right' ? 'right' : ''}`}>
            {header && <div onKeyDown={onHeaderKeyDown}>{header}</div>}
            <div ref={listRef} id={menuId} role="menu" aria-label={label} onKeyDown={onKeyDown}>
              {children}
            </div>
          </div>
        </MenuContext>
      )}
    </div>
  );
}

/** One menu item. checked turns it into a menuitemradio (the filter menus). */
export function MenuItem({ onSelect, checked, icon: Icon, children, ...rest }) {
  const { close } = useMenu();
  const isRadio = checked !== undefined;
  return (
    <button
      type="button"
      role={isRadio ? 'menuitemradio' : 'menuitem'}
      aria-checked={isRadio ? checked : undefined}
      tabIndex={-1}
      className="mi"
      onClick={() => {
        close();
        onSelect();
      }}
      {...rest}
    >
      {Icon && <Icon size={18} aria-hidden="true" />}
      {children}
    </button>
  );
}
