import { Logo } from './Logo';

/** While the refresh cookie restores the session on first load. */
export function LoadingScreen() {
  return (
    <div className="grid min-h-screen place-items-center" role="status">
      <div className="flex flex-col items-center gap-3">
        <Logo size={48} />
        <span className="muted text-sm">Opening GigVault…</span>
      </div>
    </div>
  );
}
