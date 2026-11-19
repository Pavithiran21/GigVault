import { IconArrowLeft, IconMapOff } from '@tabler/icons-react';
import { Link } from 'react-router';
import { usePageTitle } from '../hooks/usePageTitle';

/** Any address the app doesn't have. */
export function NotFoundPage() {
  usePageTitle('Page not found');
  return (
    <div className="card pad mx-auto mt-8 max-w-md text-center">
      <IconMapOff size={40} className="mx-auto text-teal-700" aria-hidden="true" />
      <h2 className="mt-2 mb-1 text-[20px]">Page not found</h2>
      <p className="muted mt-0 mb-3.5 text-sm">This page doesn&apos;t exist, or the link is wrong.</p>
      <Link to="/" className="btn btn-line">
        <IconArrowLeft size={18} aria-hidden="true" /> Go to Earnings
      </Link>
    </div>
  );
}
