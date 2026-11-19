import { zodResolver } from '@hookform/resolvers/zod';
import { IconLinkOff, IconLock } from '@tabler/icons-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { resetPassword } from '../../api/auth';
import { useAuth } from '../../auth/AuthContext';
import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { PasswordField } from '../../components/Field';
import { usePageTitle } from '../../hooks/usePageTitle';
import { AuthLayout } from '../../layout/AuthLayout';
import { applyFieldErrors, errorMessage, isNetworkError } from '../../lib/apiErrors';
import { useToast } from '../../toast/ToastContext';
import { isResetToken, resetSchema } from './authSchemas';

/** Shown instead of the form for a used, older or broken link (UI-UX.md screen 4). */
function ExpiredLink() {
  return (
    <div className="banner b-err" role="alert">
      <IconLinkOff size={18} aria-hidden="true" />
      <span>
        <b>This link has expired.</b>{' '}
        {/* The one permanent underline in the app: the only sign of a link inside red text. */}
        <Link to="/forgot-password" className="font-bold text-[#912018] underline">
          Send a new link
        </Link>
      </span>
    </div>
  );
}

/** Set a new password from the emailed link (/reset-password?token=…). */
export function ResetPasswordPage() {
  usePageTitle('Set a new password');
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { user, endSessionLocally } = useAuth();
  const { showError } = useToast();
  const [expired, setExpired] = useState(!isResetToken(token));
  const [formError, setFormError] = useState(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(resetSchema), defaultValues: { password: '', confirm: '' } });

  async function onSubmit(values) {
    setFormError(null);
    try {
      await resetPassword(token, values.password);
      // A reset logs out every session, this tab's too.
      if (user) {
        endSessionLocally('password-reset');
      }
      navigate('/login', { replace: true, state: { note: 'password-changed' } });
    } catch (error) {
      const brokenToken = error.details?.some((detail) => detail.field === 'token');
      if (error.code === 'RESET_LINK_EXPIRED' || brokenToken) {
        setExpired(true);
      } else if (isNetworkError(error)) {
        showError(error.message, { network: true });
      } else if (!applyFieldErrors(error, setError, ['password'])) {
        setFormError(errorMessage(error));
      }
    }
  }

  return (
    <AuthLayout>
      <h1 className="mt-0 mb-3 text-[24px]">Set a new password</h1>
      {expired ? (
        <ExpiredLink />
      ) : (
        <>
          {formError && (
            <Banner kind="err" className="mb-4">
              {formError}
            </Banner>
          )}
          <form noValidate onSubmit={handleSubmit(onSubmit)}>
            <PasswordField
              label="New password"
              icon={IconLock}
              autoComplete="new-password"
              hint="At least 8 characters, with a number."
              error={errors.password?.message}
              {...register('password')}
            />
            <PasswordField
              label="Confirm password"
              icon={IconLock}
              autoComplete="new-password"
              error={errors.confirm?.message}
              {...register('confirm')}
            />
            <Button type="submit" className="btn btn-teal w-full" pending={isSubmitting}>
              Save new password
            </Button>
          </form>
          <p className="hint">After a reset, every device has to log in again.</p>
        </>
      )}
    </AuthLayout>
  );
}
