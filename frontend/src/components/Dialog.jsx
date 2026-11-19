import { useEffect, useRef } from 'react';

/**
 * A modal dialog on the native <dialog> element (UI-UX.md "Keyboard"): showModal() makes the
 * page behind it inert, so focus stays inside; Esc closes it; when it closes, focus goes back to
 * the control that opened it. Centred over a scrim on desktop, a bottom sheet below 860 px.
 *
 * Render it only while it is open: mounting opens it, unmounting closes it. The element marked
 * data-autofocus gets the first focus (destructive dialogs mark their safe button).
 * variant="phone-menu" is the full-screen phone menu instead of a centred dialog.
 */
export function Dialog({ onClose, labelledBy, describedBy, role = 'dialog', wide = false, variant = 'dialog', children }) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    const returnTo = document.activeElement;

    // Esc: let React state close it, so the page decides (for example, the URL changes back).
    function handleCancel(event) {
      event.preventDefault();
      onCloseRef.current();
    }
    dialog.addEventListener('cancel', handleCancel);
    dialog.showModal();
    dialog.querySelector('[data-autofocus]')?.focus();

    return () => {
      dialog.removeEventListener('cancel', handleCancel);
      if (dialog.open) {
        dialog.close();
      }
      if (returnTo instanceof HTMLElement && document.contains(returnTo)) {
        returnTo.focus();
      }
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      role={role === 'dialog' ? undefined : role}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      className={variant === 'phone-menu' ? 'phone-menu' : `dlg ${wide ? 'wide' : ''}`}
    >
      {variant === 'dialog' && <div className="grab" aria-hidden="true" />}
      {children}
    </dialog>
  );
}
