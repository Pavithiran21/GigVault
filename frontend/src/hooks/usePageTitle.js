import { useEffect } from 'react';

/** "Gigs · GigVault" in the browser tab. */
export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · GigVault` : 'GigVault';
  }, [title]);
}
