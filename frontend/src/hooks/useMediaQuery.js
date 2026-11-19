import { useSyncExternalStore } from 'react';

/** True while the CSS media query matches, for example useMediaQuery(PHONE_QUERY). */
export function useMediaQuery(query) {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
  );
}

/** Phone layout: below 860 px (the "tab" breakpoint in index.css). */
export const PHONE_QUERY = '(width < 53.75rem)';

/** Desktop layout: from 1100 px, where Gigs shows the list beside the gig. */
export const DESKTOP_QUERY = '(width >= 68.75rem)';
