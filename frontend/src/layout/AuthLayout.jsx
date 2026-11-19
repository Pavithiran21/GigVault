import { Link } from 'react-router';
import { Logo } from '../components/Logo';

/** Log in, Create account and the password pages: one card, centred on the contour page. */
export function AuthLayout({ stepTwo = false, children }) {
  return (
    <main className="flex min-h-screen items-start justify-center px-4 py-10 max-tab:py-6">
      <div className={`auth-card ${stepTwo ? 'step-two' : ''}`}>
        <Link
          to="/login"
          className="mb-7 flex items-center gap-2 text-[20px] font-bold text-ink no-underline"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          <Logo size={34} /> GigVault
        </Link>
        {children}
      </div>
    </main>
  );
}
