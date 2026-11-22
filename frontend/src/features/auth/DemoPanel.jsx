import { IconLogin, IconPresentation } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { demoLogin, getDemoAccounts } from '../../api/demo';
import { queryKeys } from '../../api/queryKeys';
import { useAuth } from '../../auth/AuthContext';
import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { errorMessage } from '../../lib/apiErrors';

/**
 * Demo mode only (UI-UX.md screen 1): each demo account's role and email, with "Log in as <role>"
 * (User and Second user). The button asks the backend to start the session, so no password is shown
 * or held by the page (a public page that prints credentials gets flagged as phishing). GET /demo
 * answers 404 when demo mode is off; then nothing shows.
 */
export function DemoPanel() {
  const { startSession } = useAuth();
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
      startSession(await demoLogin(account.role));
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
