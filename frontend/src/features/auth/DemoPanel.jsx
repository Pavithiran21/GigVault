import { IconLogin, IconPresentation } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { getDemoAccounts } from '../../api/demo';
import { queryKeys } from '../../api/queryKeys';
import { useAuth } from '../../auth/AuthContext';
import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { errorMessage } from '../../lib/apiErrors';

/**
 * Demo mode only (UI-UX.md screen 1): each demo account's role, email and its public demo-only
 * password, with "Log in as <role>" (User and Second user). GET /demo answers 404 when demo mode is
 * off; then nothing shows.
 */
export function DemoPanel() {
  const { login } = useAuth();
  const [pendingEmail, setPendingEmail] = useState(null);
  const [error, setError] = useState(null);
  const { data } = useQuery({ queryKey: queryKeys.demo, queryFn: getDemoAccounts, retry: false, staleTime: Infinity });

  if (!data?.accounts?.length) {
    return null;
  }

  async function logInAs(account) {
    setPendingEmail(account.email);
    setError(null);
    try {
      await login({ email: account.email, password: account.password });
    } catch (loginError) {
      setError(errorMessage(loginError));
      setPendingEmail(null);
    }
  }

  return (
    <section className="demo-box" aria-labelledby="demo-title">
      <div className="eyebrow" id="demo-title">
        <IconPresentation size={16} aria-hidden="true" /> Demo mode
      </div>
      {data.accounts.map((account) => (
        <div key={account.email} className="not-first:mt-4">
          <dl className="dl mt-2.5 mb-3" style={{ gridTemplateColumns: '76px 1fr' }}>
            <dt>Role</dt>
            <dd>{account.role}</dd>
            <dt>Email</dt>
            <dd>{account.email}</dd>
            <dt>Password</dt>
            <dd>{account.password}</dd>
          </dl>
          <Button
            className="btn btn-soft w-full"
            pending={pendingEmail === account.email}
            onClick={() => logInAs(account)}
          >
            <IconLogin size={18} aria-hidden="true" /> Log in as {account.role}
          </Button>
        </div>
      ))}
      {error && (
        <Banner kind="err" className="mt-3">
          {error}
        </Banner>
      )}
    </section>
  );
}
