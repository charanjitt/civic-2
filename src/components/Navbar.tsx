import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Building2, LogOut, MapPin, Menu, ShieldCheck, UserCircle, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Navbar() {
  const { user, profile, isMunicipalStaff, signOut } = useAuth();
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close the mobile menu whenever the route changes.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const navLinkClass = (path: string) =>
    `rounded-lg px-3 py-2 text-sm font-medium transition ${
      pathname === path
        ? 'bg-civic-primary/20 text-sky-300 border border-sky-500/30'
        : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-civic-bg/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-emerald-500 text-slate-950 shadow-lg shadow-sky-500/20">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <span className="text-base font-bold tracking-tight text-white">CivicConnect</span>
            <span className="block text-[10px] uppercase tracking-widest text-sky-400">
              Smart City Twin
            </span>
          </div>
        </Link>

        <nav className="hidden items-center gap-1.5 md:flex">
          <Link to="/" className={navLinkClass('/')}>
            3D City
          </Link>
          <Link to="/citizen" className={navLinkClass('/citizen')}>
            Citizen Portal
          </Link>
          <Link to="/map" className={navLinkClass('/map')}>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              Issue Map
            </span>
          </Link>
          <Link to="/municipal" className={navLinkClass('/municipal')}>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              Municipal Portal
            </span>
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 text-slate-300 transition hover:bg-slate-800 hover:text-white md:hidden"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          {user ? (
            <>
              <Link
                to="/citizen"
                className="hidden items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-700 sm:flex"
              >
                <UserCircle className="h-4 w-4 text-sky-400" />
                <span>{profile?.full_name ?? user.email}</span>
                {isMunicipalStaff && (
                  <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                    {profile?.role.replace('_', ' ')}
                  </span>
                )}
              </Link>
              <button
                onClick={() => void signOut()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/auth"
                className="rounded-lg bg-sky-500 px-3.5 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-sky-400"
              >
                Citizen Sign In
              </Link>
              <Link
                to="/municipal/login"
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-800"
              >
                Staff Login
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Mobile navigation panel */}
      {mobileOpen && (
        <nav className="border-t border-slate-800/80 bg-civic-bg/95 px-4 py-3 backdrop-blur-md md:hidden">
          <div className="flex flex-col gap-1.5">
            <Link to="/" className={navLinkClass('/')}>
              3D City
            </Link>
            <Link to="/citizen" className={navLinkClass('/citizen')}>
              Citizen Portal
            </Link>
            <Link to="/map" className={navLinkClass('/map')}>
              Issue Map
            </Link>
            <Link to="/municipal" className={navLinkClass('/municipal')}>
              Municipal Portal
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
