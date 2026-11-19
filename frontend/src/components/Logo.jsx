import { useId } from 'react';

/**
 * The gem-cut teal tile (UI-UX.md "Brand"): four facets meeting in the centre, a mint rim,
 * a white "G" with two rising bars and a mint dot. Each copy gets its own gradient ids, so a
 * logo hidden on one layout never breaks another one's colours.
 */
export function Logo({ size = 30, className }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".45" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#ccf5ee" />
        </linearGradient>
        <filter id={`${id}d`} x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx="0" dy="2" stdDeviation="1.6" floodColor="#04302c" floodOpacity=".35" />
        </filter>
        <clipPath id={`${id}c`}>
          <rect x="3" y="3" width="58" height="58" rx="17" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}c)`}>
        <rect x="3" y="3" width="58" height="58" fill="#0b5f58" />
        <path d="M3 3H61L32 32z" fill="#17a596" />
        <path d="M61 3V61L32 32z" fill="#0f7f74" />
        <path d="M61 61H3L32 32z" fill="#06463f" />
        <path d="M3 61V3L32 32z" fill="#0d6a62" />
        <rect x="3" y="3" width="58" height="26" fill={`url(#${id}s)`} />
      </g>
      <rect x="4" y="4" width="56" height="56" rx="16" fill="none" stroke="#7ee8da" strokeOpacity=".55" strokeWidth="1.4" />
      <g
        filter={`url(#${id}d)`}
        fill="none"
        stroke={`url(#${id}g)`}
        strokeWidth="5.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M42.2 23.6A14 14 0 1 0 46 34H34.5" />
      </g>
      <g fill="#a7f3d0">
        <rect x="35.5" y="38" width="3.2" height="4.5" rx="1" />
        <rect x="40" y="35.5" width="3.2" height="7" rx="1" />
      </g>
      <circle cx="51.5" cy="12.5" r="2.4" fill="#a7f3d0" />
    </svg>
  );
}

/** "Gig" in ink and "Vault" in teal, Sora bold. */
export function Wordmark() {
  return (
    <span>
      Gig<span className="text-teal-700">Vault</span>
    </span>
  );
}
