import { zodResolver } from '@hookform/resolvers/zod';
import { IconCoins, IconLock, IconMail, IconUser } from '@tabler/icons-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { useAuth } from '../../auth/AuthContext';
import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { PasswordField, SelectField, TextField } from '../../components/Field';
import { usePageTitle } from '../../hooks/usePageTitle';
import { AuthLayout } from '../../layout/AuthLayout';
import { applyFieldErrors, errorMessage, isNetworkError } from '../../lib/apiErrors';
import { CURRENCIES } from '../../lib/enums';
import { deviceTimeZone } from '../../lib/timeZones';
import { useToast } from '../../toast/ToastContext';
import { registerSchema } from './authSchemas';

const FIELDS = ['name', 'email', 'password', 'defaultCurrency'];

/** Create account (UI-UX.md screen 3). The time zone comes from the device and is not shown. */
export function RegisterPage() {
  usePageTitle('Create account');
  const { register: signUp } = useAuth();
  const { showError } = useToast();
  const [formError, setFormError] = useState(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', defaultCurrency: 'INR' },
  });

  async function onSubmit(values) {
    setFormError(null);
    try {
      try {
        await signUp({ ...values, timeZone: deviceTimeZone() });
      } catch (error) {
        // A device zone the backend's list doesn't know: sign up with its default instead; it can
        // be changed in Profile. There is no time-zone field here to show the message under.
        if (!error.details?.some((detail) => detail.field === 'timeZone')) {
          throw error;
        }
        await signUp(values);
      }
      // GuestOnly now opens Earnings, which shows "No gigs yet".
    } catch (error) {
      if (isNetworkError(error)) {
        showError(error.message, { network: true });
      } else if (!applyFieldErrors(error, setError, FIELDS)) {
        setFormError(errorMessage(error));
      }
    }
  }

  return (
    <AuthLayout>
      <h1 className="mt-0 mb-1 text-[24px]">Create your account</h1>
      <p className="muted mt-0 mb-4">Free for freelancers.</p>
      {formError && (
        <Banner kind="err" className="mb-4">
          {formError}
        </Banner>
      )}
      <form noValidate onSubmit={handleSubmit(onSubmit)}>
        <TextField
          label="Name"
          icon={IconUser}
          autoComplete="name"
          maxLength={80}
          error={errors.name?.message}
          {...register('name')}
        />
        <TextField
          label="Email"
          type="email"
          icon={IconMail}
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <PasswordField
          label="Password"
          icon={IconLock}
          autoComplete="new-password"
          hint="At least 8 characters, with a number."
          error={errors.password?.message}
          {...register('password')}
        />
        <SelectField
          label="Default currency"
          icon={IconCoins}
          hint="All amounts use this currency. No conversion. Your time zone is taken from this device; change it later in Profile."
          error={errors.defaultCurrency?.message}
          {...register('defaultCurrency')}
        >
          {CURRENCIES.map((currency) => (
            <option key={currency.code} value={currency.code}>
              {currency.code} · {currency.name}
            </option>
          ))}
        </SelectField>
        <Button type="submit" className="btn btn-teal w-full" pending={isSubmitting}>
          Create account
        </Button>
      </form>
      <p className="muted mt-4 mb-0 text-sm">
        Already have an account?{' '}
        <Link to="/login" className="link">
          Log in
        </Link>
      </p>
    </AuthLayout>
  );
}
