import { IconAlertCircle, IconCircleCheck, IconWifiOff, IconX } from '@tabler/icons-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ToastContext } from './ToastContext';

const TOAST_MS = 4000;
const MAX_INFO_TOASTS = 3;

/**
 * Toasts, bottom right (UI-UX.md "Toasts"): white with a teal left edge, gone after 4 seconds.
 * Errors have a red edge and stay until dismissed. The two live regions are always on the page,
 * so a screen reader announces each new toast (a live region added together with its text
 * often isn't read out).
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((toast) => toast.id !== id));
  }, []);

  /** { message, icon?: TablerIcon, action?: { label, onClick } } */
  const showToast = useCallback(
    ({ message, icon, action }) => {
      const id = nextId.current++;
      setToasts((list) => {
        // At most three confirmations on screen: the oldest goes first.
        const info = list.filter((toast) => toast.kind === 'info');
        const dropped = info.length >= MAX_INFO_TOASTS ? info[0].id : null;
        return [...list.filter((toast) => toast.id !== dropped), { id, kind: 'info', message, icon, action }];
      });
      setTimeout(() => dismiss(id), TOAST_MS);
    },
    [dismiss],
  );

  /** A red toast that stays until dismissed; network: true uses the wifi-off icon. */
  const showError = useCallback((message, { network = false } = {}) => {
    const id = nextId.current++;
    setToasts((list) => {
      // The same error twice in a row (two failed requests) shows once.
      if (list.some((toast) => toast.kind === 'error' && toast.message === message)) {
        return list;
      }
      return [...list, { id, kind: 'error', message, icon: network ? IconWifiOff : IconAlertCircle }];
    });
  }, []);

  const value = useMemo(() => ({ showToast, showError }), [showToast, showError]);

  return (
    <ToastContext value={value}>
      {children}
      <div className="toasts">
        <div role="status" className="flex flex-col items-end gap-2 max-tab:items-stretch">
          {toasts
            .filter((toast) => toast.kind === 'info')
            .map((toast) => {
              const Icon = toast.icon ?? IconCircleCheck;
              return (
                <div key={toast.id} className="toast">
                  <Icon size={19} aria-hidden="true" />
                  <span>{toast.message}</span>
                  {toast.action && (
                    <button type="button" className="link ml-2" onClick={toast.action.onClick}>
                      {toast.action.label}
                    </button>
                  )}
                </div>
              );
            })}
        </div>
        <div role="alert" className="flex flex-col items-end gap-2 max-tab:items-stretch">
          {toasts
            .filter((toast) => toast.kind === 'error')
            .map((toast) => {
              const Icon = toast.icon;
              return (
                <div key={toast.id} className="toast err">
                  <Icon size={19} aria-hidden="true" />
                  <span className="flex-1">{toast.message}</span>
                  <button
                    type="button"
                    className="icon-btn sm"
                    aria-label="Dismiss"
                    onClick={() => dismiss(toast.id)}
                  >
                    <IconX size={16} aria-hidden="true" />
                  </button>
                </div>
              );
            })}
        </div>
      </div>
    </ToastContext>
  );
}
