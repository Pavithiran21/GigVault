import { zodResolver } from '@hookform/resolvers/zod';
import { IconLock, IconLockCheck, IconLockPlus } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { changePassword, deleteAccount } from '../../api/profile';
import { useAuth } from '../../auth/AuthContext';
import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { PasswordField } from '../../components/Field';
import { applyFieldErrors, errorMessage, isNetworkError } from '../../lib/apiErrors';
import { useToast } from '../../toast/ToastContext';
import { currentPasswordField, newPasswordField } from '../auth/authSchemas';

const changePasswordSchema = z
  .object({ currentPassword: currentPasswordField, newPassword: newPasswordField, confirm: z.string() })
  .refine((values) => values.newPassword === values.confirm, {
    path: ['confirm'],
    message: "Passwords don't match.",
  });

const deleteAccountSchema = z.object({ password: currentPasswordField });

/**
 * Change password (UI-UX.md screen 16). The other sessions end; this one gets a new token.
 * A demo account is refused by the server (403), and the dialog shows its message: the buttons stay
 * clickable on purpose, so the demo proves the lock is enforced by the backend.
 */
export function ChangePasswordDialog({ onClose }) {
  const titleId = useId();
  const { startSession } = useAuth();
  const { showToast, showError } = useToast();
  const [formError, setFormError] = useState(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirm: '' },
  });

  const save = useMutation({
    mutationFn: (values) => changePassword(values.currentPassword, values.newPassword),
    onSuccess: (session) => {
      startSession(session);
      showToast({ message: 'Password changed. Other devices are logged out.' });
      onClose();
    },
    onError: (error) => {
      if (isNetworkError(error)) {
        showError(error.message, { network: true });
      } else if (!applyFieldErrors(error, setError, ['currentPassword', 'newPassword'])) {
        setFormError(errorMessage(error));
      }
    },
  });

  return (
    <Dialog labelledBy={titleId} onClose={onClose}>
      <form
        noValidate
        onSubmit={handleSubmit((values) => {
          setFormError(null);
          save.mutate(values);
        })}
      >
        <h3 id={titleId}>Change password</h3>
        <p className="muted mt-0 mb-4 text-sm">Other devices are logged out after the change.</p>
        {formError && (
          <Banner kind="err" icon={IconLock} className="mb-3.5">
            {formError}
          </Banner>
        )}
        <PasswordField
          label="Current password"
          icon={IconLock}
          autoComplete="current-password"
          autoFocus
          error={errors.currentPassword?.message}
          {...register('currentPassword')}
        />
        <PasswordField
          label="New password"
          icon={IconLockPlus}
          autoComplete="new-password"
          hint="At least 8 characters, with a number."
          error={errors.newPassword?.message}
          {...register('newPassword')}
        />
        <PasswordField
          label="Confirm new password"
          icon={IconLockCheck}
          autoComplete="new-password"
          error={errors.confirm?.message}
          {...register('confirm')}
        />
        <div className="acts">
          <button type="button" className="btn btn-line" onClick={onClose}>
            {formError ? 'Close' : 'Cancel'}
          </button>
          <Button type="submit" className="btn btn-teal" pending={save.isPending}>
            Change password
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** Delete account (UI-UX.md screen 17): the password first; "Keep account" has the first focus. */
export function DeleteAccountDialog({ onClose }) {
  const titleId = useId();
  const textId = useId();
  const { endSessionLocally } = useAuth();
  const { showError } = useToast();
  const [formError, setFormError] = useState(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({ resolver: zodResolver(deleteAccountSchema), defaultValues: { password: '' } });

  const remove = useMutation({
    mutationFn: (values) => deleteAccount(values.password),
    // Everything is gone on the server; Log in comes next (RequireAuth sends the user there).
    onSuccess: () => endSessionLocally('account-deleted'),
    onError: (error) => {
      if (isNetworkError(error)) {
        showError(error.message, { network: true });
      } else if (!applyFieldErrors(error, setError, ['password'])) {
        setFormError(errorMessage(error));
      }
    },
  });

  return (
    <Dialog role="alertdialog" labelledBy={titleId} describedBy={textId} onClose={onClose}>
      <form
        noValidate
        onSubmit={handleSubmit((values) => {
          setFormError(null);
          remove.mutate(values);
        })}
      >
        <h3 id={titleId}>Delete your account?</h3>
        <p id={textId} className="muted mt-0 mb-3.5 text-sm">
          All your clients, gigs, payments and files are permanently removed, and you are logged out. This can&apos;t be
          undone.
        </p>
        {formError && (
          <Banner kind="err" icon={IconLock} className="mb-3.5">
            {formError}
          </Banner>
        )}
        <PasswordField
          label="Type your password to confirm"
          icon={IconLock}
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <div className="acts">
          <button type="button" className="btn btn-line" data-autofocus onClick={onClose}>
            Keep account
          </button>
          <Button type="submit" className="btn btn-red" pending={remove.isPending}>
            Delete account
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
