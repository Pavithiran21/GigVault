import { Navigate, Outlet, useLocation } from 'react-router';
import { LoadingScreen } from '../components/LoadingScreen';
import { useAuth } from './AuthContext';

/**
 * Pages for logged-in users, and the one place that sends a signed-out user to Log in.
 * A guest, or a user whose session ended by itself, comes back here after logging in, so a link
 * to a gig still opens that gig. A user who logged out or deleted the account starts fresh.
 */
export function RequireAuth() {
  const { user, isLoading, signOutReason } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingScreen />;
  }
  if (!user) {
    const state = signOutReason ? null : { from: location };
    return <Navigate to="/login" replace state={state} />;
  }
  return <Outlet />;
}

/** Log in, Create account and Forgot password. A logged-in user goes to the page they wanted, or home. */
export function GuestOnly() {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingScreen />;
  }
  if (user) {
    const from = location.state?.from;
    return <Navigate to={from ? from.pathname + from.search : '/'} replace />;
  }
  return <Outlet />;
}
