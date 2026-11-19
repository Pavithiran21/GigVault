import { IconAlertCircle, IconChevronDown, IconEye, IconEyeOff } from '@tabler/icons-react';
import { useId, useState } from 'react';

/**
 * Every form field (UI-UX.md "Labels"): a visible label, "(optional)" where it applies, a leading
 * icon, the error under the field with aria-invalid and aria-describedby, then the hint.
 * React Hook Form's register() spreads onto it; ref is a normal prop in React 19.
 */
function FieldShell({ inputId, label, optional, error, hint, className = '', children }) {
  return (
    <div className={`field ${error ? 'bad' : ''} ${className}`}>
      <label htmlFor={inputId}>
        {label}
        {optional && <span className="opt"> (optional)</span>}
      </label>
      {children}
      {error && (
        <div className="ferr" id={`${inputId}-error`}>
          <IconAlertCircle size={16} aria-hidden="true" /> {error}
        </div>
      )}
      {hint && (
        <div className="hint" id={`${inputId}-hint`}>
          {hint}
        </div>
      )}
    </div>
  );
}

function describedBy(inputId, error, hint) {
  const ids = [error ? `${inputId}-error` : null, hint ? `${inputId}-hint` : null].filter(Boolean);
  return ids.length > 0 ? ids.join(' ') : undefined;
}

export function TextField({ label, optional, icon: Icon, error, hint, suffix, end, className, id, ref, ...inputProps }) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <FieldShell inputId={inputId} label={label} optional={optional} error={error} hint={hint} className={className}>
      <div className={`inp ${suffix || end ? 'with-suffix' : ''}`}>
        {Icon && <Icon size={18} className="lead" aria-hidden="true" />}
        <input
          id={inputId}
          ref={ref}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy(inputId, error, hint)}
          {...inputProps}
        />
        {suffix && (
          <span className="suffix" aria-hidden="true">
            {suffix}
          </span>
        )}
        {end}
      </div>
    </FieldShell>
  );
}

/** A password field with a show/hide button (log in, sign-up, reset, account dialogs). */
export function PasswordField(props) {
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      {...props}
      type={visible ? 'text' : 'password'}
      end={
        <button
          type="button"
          className="suffix-btn"
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          onClick={() => setVisible((shown) => !shown)}
        >
          {visible ? <IconEyeOff size={18} aria-hidden="true" /> : <IconEye size={18} aria-hidden="true" />}
        </button>
      }
    />
  );
}

export function SelectField({ label, optional, icon: Icon, error, hint, className, id, ref, children, ...selectProps }) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <FieldShell inputId={inputId} label={label} optional={optional} error={error} hint={hint} className={className}>
      <div className="inp">
        {Icon && <Icon size={18} className="lead" aria-hidden="true" />}
        <select
          id={inputId}
          ref={ref}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy(inputId, error, hint)}
          {...selectProps}
        >
          {children}
        </select>
        <IconChevronDown size={16} className="suffix" aria-hidden="true" />
      </div>
    </FieldShell>
  );
}

export function TextAreaField({ label, optional, error, hint, className, id, ref, ...areaProps }) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <FieldShell inputId={inputId} label={label} optional={optional} error={error} hint={hint} className={className}>
      <textarea
        id={inputId}
        ref={ref}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy(inputId, error, hint)}
        {...areaProps}
      />
    </FieldShell>
  );
}
