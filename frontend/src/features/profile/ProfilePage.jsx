import { zodResolver } from '@hookform/resolvers/zod';
import { IconCoins, IconPresentation, IconUser, IconWorld } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { updateProfile } from '../../api/profile';
import { useAuth } from '../../auth/AuthContext';
import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { SelectField, TextField } from '../../components/Field';
import { usePageTitle } from '../../hooks/usePageTitle';
import { applyFieldErrors, errorMessage, isNetworkError } from '../../lib/apiErrors';
import { initials } from '../../lib/clientTint';
import { timestampMonthYear } from '../../lib/dates';
import { CURRENCIES } from '../../lib/enums';
import { timeZoneOptions } from '../../lib/timeZones';
import { useToast } from '../../toast/ToastContext';
import { nameField } from '../auth/authSchemas';
import { ChangePasswordDialog, DeleteAccountDialog } from './AccountDialogs';

const profileSchema = z.object({ name: nameField, defaultCurrency: z.string(), timeZone: z.string() });
const PROFILE_FIELDS = ['name', 'defaultCurrency', 'timeZone'];

/**
 * Profile (UI-UX.md screen 15): name, default currency (relabels amounts, never converts them) and
 * time zone (decides "today" and "this month"). Save is enabled only after a change, and only the
 * changed fields are sent.
 */
export function ProfilePage() {
  usePageTitle('Profile');
  const { user, updateUser } = useAuth();
  const queryClient = useQueryClient();
  const { showToast, showError } = useToast();
  const [dialog, setDialog] = useState(null); // 'password' | 'delete'
  const [formError, setFormError] = useState(null);
  const zones = useMemo(() => timeZoneOptions(user.timeZone), [user.timeZone]);

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, dirtyFields, isDirty },
  } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user.name, defaultCurrency: user.defaultCurrency, timeZone: user.timeZone },
  });

  const save = useMutation({
    mutationFn: (values) => {
      const changes = Object.fromEntries(PROFILE_FIELDS.filter((field) => dirtyFields[field]).map((field) => [field, values[field]]));
      return updateProfile(changes);
    },
    onSuccess: (updated) => {
      updateUser(updated);
      reset({ name: updated.name, defaultCurrency: updated.defaultCurrency, timeZone: updated.timeZone });
      // The currency labels every amount and the time zone decides "this month": refresh it all.
      queryClient.invalidateQueries();
      showToast({ message: 'Changes saved' });
    },
    onError: (error) => {
      if (isNetworkError(error)) {
        showError(error.message, { network: true });
      } else if (!applyFieldErrors(error, setError, PROFILE_FIELDS)) {
        setFormError(errorMessage(error));
      }
    },
  });

  return (
    <div className="card pad mx-auto max-w-[560px]">
      <div className="mb-4.5 flex items-center gap-3">
        <span className="av round" style={{ width: 52, height: 52, fontSize: 18 }} aria-hidden="true">
          {initials(user.name)}
        </span>
        <div className="min-w-0">
          <h2 className="m-0 text-[20px]">Profile</h2>
          <span className="muted break-all">
            {user.email} · since {timestampMonthYear(user.createdAt, user.timeZone)}
          </span>
        </div>
      </div>
      {user.isDemo && (
        <Banner kind="info" icon={IconPresentation} className="mb-3.5">
          <b>Demo account.</b> Everything works, but the password can&apos;t be changed and the account can&apos;t be
          deleted.
        </Banner>
      )}
      {formError && (
        <Banner kind="err" className="mb-3.5">
          {formError}
        </Banner>
      )}
      <form
        noValidate
        onSubmit={handleSubmit((values) => {
          setFormError(null);
          save.mutate(values);
        })}
      >
        <TextField
          label="Name"
          icon={IconUser}
          autoComplete="name"
          maxLength={80}
          error={errors.name?.message}
          {...register('name')}
        />
        <SelectField
          label="Default currency"
          icon={IconCoins}
          hint="Changing it relabels amounts; it does not convert them."
          error={errors.defaultCurrency?.message}
          {...register('defaultCurrency')}
        >
          {CURRENCIES.map((currency) => (
            <option key={currency.code} value={currency.code}>
              {currency.code} · {currency.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Time zone"
          icon={IconWorld}
          hint="Decides what “today” and “this month” mean."
          error={errors.timeZone?.message}
          {...register('timeZone')}
        >
          {zones.map((zone) => (
            <option key={zone.value} value={zone.value}>
              {zone.label}
            </option>
          ))}
        </SelectField>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" className="btn btn-teal" pending={save.isPending} disabled={!isDirty}>
            Save changes
          </Button>
          <button type="button" className="btn btn-line" onClick={() => setDialog('password')}>
            Change password
          </button>
        </div>
      </form>
      <div className="mt-4.5 flex items-center gap-2.5 border-t border-line pt-3.5">
        <div className="flex-1">
          <b className="text-red">Delete account</b>
          <div className="muted text-[13px]">Removes clients, gigs, payments and files.</div>
        </div>
        <button type="button" className="btn btn-danger-line" onClick={() => setDialog('delete')}>
          Delete
        </button>
      </div>
      {dialog === 'password' && <ChangePasswordDialog onClose={() => setDialog(null)} />}
      {dialog === 'delete' && <DeleteAccountDialog onClose={() => setDialog(null)} />}
    </div>
  );
}
