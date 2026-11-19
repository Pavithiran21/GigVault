import { zodResolver } from '@hookform/resolvers/zod';
import { IconClock, IconHourglass, IconLock, IconMail } from '@tabler/icons-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation } from 'react-router';
import { useAuth } from '../../auth/AuthContext';
import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { PasswordField, TextField } from '../../components/Field';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useToast } from '../../toast/ToastContext';
import { AuthLayout } from '../../layout/AuthLayout';
import { errorMessage, isNetworkError } from '../../lib/apiErrors';
import { loginEmailSchema, loginPasswordSchema } from './authSchemas';
import { DemoPanel } from './DemoPanel';
import { StatementCard } from './StatementCard';

/** Step 1: the email only. Nothing is asked of the server yet, so no one can test which emails exist. */
function EmailStep({ email, onContinue }) {
  const { sessionEnded } = useAuth();
  const location = useLocation();
  const passwordChanged = location.state?.note === 'password-changed';
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(loginEmailSchema), defaultValues: { email } });

  return (
    <>
      {sessionEnded && (
        <Banner kind="info" icon={IconClock} className="mb-4">
          Your session has ended. Please log in again.
        </Banner>
      )}
      {passwordChanged && !sessionEnded && (
        <Banner kind="ok" className="mb-4">
          Password changed. Log in with your new password.
        </Banner>
      )}
      <span className="stepno">Step 1 of 2</span>
      <h1 className="mt-0 mb-1.5 text-[34px] leading-tight max-tab:text-[28px]">Log in to GigVault</h1>
      <p className="muted mt-0 mb-5.5">Track every gig and every payment in one place.</p>
      <form noValidate onSubmit={handleSubmit((values) => onContinue(values.email))}>
        <TextField
          label="Email"
          type="email"
          icon={IconMail}
          autoComplete="username"
          autoFocus
          error={errors.email?.message}
          {...register('email')}
        />
        <button type="submit" className="btn btn-teal w-full">
          Continue
        </button>
      </form>
      <p className="muted mt-4 mb-0 text-sm">
        New here?{' '}
        <Link to="/register" className="link">
          Create a free account
        </Link>
      </p>
      <StatementCard />
      <DemoPanel />
    </>
  );
}

/** Step 2: the typed email (never the user's name, which would reveal the account), then the password. */
function PasswordStep({ email, onChangeEmail }) {
  const { login } = useAuth();
  const { showError } = useToast();
  const [formError, setFormError] = useState(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(loginPasswordSchema), defaultValues: { password: '' } });

  async function onSubmit(values) {
    setFormError(null);
    try {
      await login({ email, password: values.password });
      // GuestOnly now sends the user on to the page they wanted.
    } catch (error) {
      if (error.code === 'INVALID_CREDENTIALS') {
        // One message for a wrong email or a wrong password (UI-UX.md screen 2).
        setError('password', { type: 'server', message: error.message }, { shouldFocus: true });
      } else if (isNetworkError(error)) {
        showError(error.message, { network: true });
      } else {
        setFormError(errorMessage(error));
      }
    }
  }

  return (
    <>
      <span className="stepno">Step 2 of 2</span>
      <h2 className="mt-0 mb-3.5 text-[28px]">Enter your password</h2>
      <div className="who">
        <span className="av bg-teal-50 text-teal-800">
          <IconMail size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <b className="block truncate text-ink">{email}</b>
          <div className="muted text-[13px]">
            Not you?{' '}
            <button type="button" className="link" onClick={onChangeEmail}>
              Change email
            </button>
          </div>
        </div>
      </div>
      {formError && (
        <Banner kind="err" icon={IconHourglass} className="mb-3.5">
          {formError}
        </Banner>
      )}
      <form noValidate onSubmit={handleSubmit(onSubmit)}>
        {/* The email travels with the form, so password managers save the pair. */}
        <input type="email" name="username" value={email} autoComplete="username" readOnly hidden />
        <PasswordField
          label="Password"
          icon={IconLock}
          autoComplete="current-password"
          autoFocus
          error={errors.password?.message}
          {...register('password')}
        />
        <div className="-mt-1 mb-4.5 text-right">
          <Link to="/forgot-password" state={{ email }} className="link">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" className="btn btn-teal w-full" pending={isSubmitting}>
          Log in
        </Button>
      </form>
    </>
  );
}

/** Log in, in two steps, email first (UI-UX.md screens 1 and 2, sample sections 02 and 12). */
export function LoginPage() {
  usePageTitle('Log in');
  const [email, setEmail] = useState(null);
  const [lastEmail, setLastEmail] = useState('');

  return (
    <AuthLayout stepTwo={email !== null}>
      {email === null ? (
        <EmailStep
          email={lastEmail}
          onContinue={(value) => {
            setLastEmail(value);
            setEmail(value);
          }}
        />
      ) : (
        <PasswordStep email={email} onChangeEmail={() => setEmail(null)} />
      )}
    </AuthLayout>
  );
}
