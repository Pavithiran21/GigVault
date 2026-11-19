import { IconAlertCircle, IconCircleCheck, IconInfoCircle } from '@tabler/icons-react';

const KINDS = {
  info: { className: 'b-info', icon: IconInfoCircle, role: 'status' },
  ok: { className: 'b-ok', icon: IconCircleCheck, role: 'status' },
  err: { className: 'b-err', icon: IconAlertCircle, role: 'alert' },
};

/** A notice above a form: info and ok are role="status", err is role="alert" (UI-UX.md "Labels"). */
export function Banner({ kind = 'info', icon, className = '', children }) {
  const style = KINDS[kind];
  const Icon = icon ?? style.icon;
  return (
    <div className={`banner ${style.className} ${className}`} role={style.role}>
      <Icon size={18} aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}
