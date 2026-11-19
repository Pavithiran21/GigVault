import {
  IconBriefcase,
  IconCash,
  IconChartAreaLine,
  IconLogout,
  IconMenu2,
  IconSearch,
  IconUserCircle,
  IconUsers,
  IconX,
} from '@tabler/icons-react';
import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { Dialog } from '../components/Dialog';
import { Logo } from '../components/Logo';
import { Menu, MenuItem } from '../components/Menu';
import { PHONE_QUERY, useMediaQuery } from '../hooks/useMediaQuery';
import { initials } from '../lib/clientTint';

const TABS = [
  { to: '/', label: 'Earnings', icon: IconChartAreaLine, end: true },
  { to: '/gigs', label: 'Gigs', icon: IconBriefcase },
  { to: '/clients', label: 'Clients', icon: IconUsers },
  { to: '/payments', label: 'Payments', icon: IconCash },
];

/** The phone header's title: the page's name. */
function pageName(pathname) {
  if (pathname.startsWith('/gigs')) return 'Gigs';
  if (pathname.startsWith('/clients')) return 'Clients';
  if (pathname.startsWith('/payments')) return 'Payments';
  if (pathname.startsWith('/profile')) return 'Profile';
  if (pathname === '/') return 'Earnings';
  return 'GigVault';
}

/** "Search gigs": Enter opens Gigs with the search applied (UI-UX.md "Navigation"). */
function GigSearch({ onDone, className = '' }) {
  const navigate = useNavigate();
  const [text, setText] = useState('');
  return (
    <form
      role="search"
      className={`inp ${className}`}
      onSubmit={(event) => {
        event.preventDefault();
        const q = text.trim();
        navigate(q ? `/gigs?q=${encodeURIComponent(q)}` : '/gigs');
        setText('');
        onDone?.();
      }}
    >
      <IconSearch size={18} className="lead" aria-hidden="true" />
      <input
        type="search"
        placeholder="Search gigs"
        aria-label="Search gigs"
        maxLength={100}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
    </form>
  );
}

function AccountMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <Menu
      label="Account"
      align="right"
      trigger={({ buttonProps }) => (
        <button {...buttonProps} className="avatar-btn" aria-label="Account menu">
          {initials(user.name)}
        </button>
      )}
      header={
        <div className="mb-1.5 border-b border-line px-2.5 pt-2 pb-2.5" style={{ width: 226 }}>
          <b className="block truncate text-ink">{user.name}</b>
          <div className="muted truncate text-[13px]">{user.email}</div>
        </div>
      }
    >
      <MenuItem icon={IconUserCircle} onSelect={() => navigate('/profile')}>
        Profile
      </MenuItem>
      <MenuItem icon={IconLogout} onSelect={logout}>
        Log out
      </MenuItem>
    </Menu>
  );
}

/** The phone menu (UI-UX.md "Phone"): the four tabs, the search, Profile and Log out; no tab bar. */
function PhoneMenu({ onClose }) {
  const { logout } = useAuth();
  return (
    <Dialog variant="phone-menu" labelledBy="phone-menu-title" onClose={onClose}>
      <div className="flex items-center gap-2">
        <Logo size={30} />
        <b id="phone-menu-title" className="h flex-1 text-base">
          Menu
        </b>
        <button type="button" className="icon-btn bare" aria-label="Close menu" data-autofocus onClick={onClose}>
          <IconX size={22} aria-hidden="true" />
        </button>
      </div>
      <nav className="menu mt-3.5" style={{ boxShadow: 'none' }} aria-label="Main">
        {TABS.map((tab) => (
          <NavLink key={tab.to} to={tab.to} end={tab.end} className="mi" onClick={onClose}>
            <tab.icon size={18} aria-hidden="true" /> {tab.label}
          </NavLink>
        ))}
        <hr />
        <GigSearch className="mx-1 my-1.5" onDone={onClose} />
        <hr />
        <NavLink to="/profile" className="mi" onClick={onClose}>
          <IconUserCircle size={18} aria-hidden="true" /> Profile
        </NavLink>
        <button type="button" className="mi" onClick={logout}>
          <IconLogout size={18} aria-hidden="true" /> Log out
        </button>
      </nav>
    </Dialog>
  );
}

/**
 * Every logged-in page: the frosted top bar (logo, tabs with a teal underline, search, avatar) on
 * desktop; on a phone, the logo, the page's title and a menu button.
 */
export function AppShell() {
  const isPhone = useMediaQuery(PHONE_QUERY);
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <header className="bar">
        <div className="bar-inner">
          {isPhone ? (
            <>
              <Link to="/" aria-label="GigVault, Earnings" className="flex">
                <Logo size={30} />
              </Link>
              <b className="h flex-1 text-base">{pageName(pathname)}</b>
              <button
                type="button"
                className="icon-btn bare"
                aria-label="Menu"
                aria-haspopup="dialog"
                onClick={() => setMenuOpen(true)}
              >
                <IconMenu2 size={22} aria-hidden="true" />
              </button>
            </>
          ) : (
            <>
              <Link to="/" className="bar-logo" aria-label="GigVault, Earnings">
                <Logo size={30} /> GigVault
              </Link>
              <nav className="tabs" aria-label="Main">
                {TABS.map((tab) => (
                  <NavLink key={tab.to} to={tab.to} end={tab.end}>
                    {tab.label}
                  </NavLink>
                ))}
              </nav>
              <GigSearch className="w-[220px]" />
              <AccountMenu />
            </>
          )}
        </div>
      </header>
      {isPhone && menuOpen && <PhoneMenu onClose={() => setMenuOpen(false)} />}
      <main className="content">
        <Outlet />
      </main>
    </>
  );
}
