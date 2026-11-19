import { IconLoader2 } from '@tabler/icons-react';

/**
 * A button that shows a spinner and can't be pressed again while its request runs
 * (UI-UX.md "Forms": button spinner, no double submit).
 */
export function Button({ pending = false, disabled = false, type = 'button', children, ...rest }) {
  return (
    <button type={type} disabled={disabled || pending} aria-busy={pending || undefined} {...rest}>
      {pending && <IconLoader2 size={18} className="spin" aria-hidden="true" />}
      {children}
    </button>
  );
}
