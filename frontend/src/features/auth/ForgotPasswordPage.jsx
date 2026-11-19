import { zodResolver } from '@hookform/resolvers/zod';
import { IconMail, IconMailCheck } from '@tabler/icons-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation } from 'react-router';
import { forgotPassword } from '../../api/auth';
import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { TextField } from '../../components/Field';
import { usePageTitle } from '../../hooks/usePageTitle';
import { AuthLayout } from '../../layout/AuthLayout';
import { applyFieldErrors, errorMessage, isNetworkError } from '../../lib/apiErrors';
import { useToast } from '../../toast/ToastContext';
import { forgotSchema } from './authSchemas';

/**
 * Forgot password (UI-UX.md screen 4). The answer is the same "Check your inbox" for every email,
 * so the page never tells whether an account exists.
 */
export function ForgotPasswordPage() {
  usePageTitle('Forgot password');
  const location = useLocation();
  const { showError } = useToast();
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(forgotSchema), defaultValues: { email: location.state?.email ?? '' } });

  async function onSubmit(values) {
    setFormError(null);
    try {
      await forgotPassword(values.email);
      setSent(true);
    } catch (error) {
      setSent(false);
      if (isNetworkError(error)) {
        showError(error.message, { network: true });
      } else if (!applyFieldErrors(error, setError, ['email'])) {
        setFormError(errorMessage(error));
      }
    }
  }

  return (
    <AuthLayout>
      <h1 className="mt-0 mb-1 text-[24px]">Forgot password?</h1>
      <p className="muted mt-0 mb-3.5">We&apos;ll email you a reset link.</p>
      {formError && (
        <Banner kind="err" className="mb-4">
          {formError}
        </Banner>
      )}
      <form noValidate onSubmit={handleSubmit(onSubmit)}>
        <TextField
          label="Email"
          type="email"
          icon={IconMail}
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <Button type="submit" className="btn btn-teal w-full" pending={isSubmitting}>
          Send reset link
        </Button>
      </form>
      {sent && (
        <Banner kind="ok" icon={IconMailCheck} className="mt-3.5">
          <b>Check your inbox.</b> If an account exists for this email, a link is on its way. It works once and
          expires in 30 minutes.
        </Banner>
      )}
      <p className="muted mt-4 mb-0 text-sm">
        Remembered it?{' '}
        <Link to="/login" className="link">
          Log in
        </Link>
      </p>
    </AuthLayout>
  );
}
