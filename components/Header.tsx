import React, { useEffect, useRef, useState } from 'react';
import { User } from '../types';
import BrandMark from './BrandMark';

interface HeaderProps {
  user: User | null;
  /** Clicking the lab's name goes back to the first page (the evaluation picker). */
  onHome: () => void;
  onLogout: () => void;
  onChangePassword?: () => void;
  onOpenAccessRequests?: () => void;
  onOpenPartnerOrgs?: () => void;
}

const navButton =
  'px-3 py-1.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring';

const menuItem =
  'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-left text-foreground hover:bg-muted focus:outline-none focus-visible:bg-muted';

/** One header for every signed-in screen: the lab's name on the left, admin tools and the account menu on the right. */
const Header: React.FC<HeaderProps> = ({ user, onHome, onLogout, onChangePassword, onOpenAccessRequests, onOpenPartnerOrgs }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close on outside click or Escape; return focus to the trigger on Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setMenuOpen(false); buttonRef.current?.focus(); }
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onPointer); document.removeEventListener('keydown', onKey); };
  }, [menuOpen]);

  const run = (fn?: () => void) => () => { setMenuOpen(false); fn?.(); };
  const isAdmin = user?.role === 'admin';
  const initial = (user?.email?.[0] ?? '?').toUpperCase();

  return (
    <header className="sticky top-0 z-40 bg-card border-b border-border">
      <div className="max-w-7xl mx-auto h-16 px-4 sm:px-6 flex items-center justify-between gap-4">
        <BrandMark onClick={onHome} />

        {user && (
          <div className="flex items-center gap-1">
            {isAdmin && (
              <nav aria-label="Admin" className="hidden md:flex items-center gap-1 mr-2">
                {onOpenAccessRequests && <button type="button" onClick={onOpenAccessRequests} className={navButton}>Access requests</button>}
                {onOpenPartnerOrgs && <button type="button" onClick={onOpenPartnerOrgs} className={navButton}>Partner orgs</button>}
              </nav>
            )}

            <div className="relative" ref={menuRef}>
              <button
                ref={buttonRef}
                type="button"
                onClick={() => setMenuOpen(o => !o)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label="Account menu"
                className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full border border-border hover:bg-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-semibold grid place-items-center">{initial}</span>
                <span className="hidden sm:block max-w-[180px] truncate text-sm text-foreground">{user.email}</span>
                <svg viewBox="0 0 20 20" fill="currentColor" className={`w-4 h-4 text-muted-foreground transition-transform ${menuOpen ? 'rotate-180' : ''}`} aria-hidden="true">
                  <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                </svg>
              </button>

              {menuOpen && (
                <div role="menu" className="absolute right-0 mt-2 w-64 rounded-xl border border-border bg-popover text-popover-foreground shadow-lg p-1.5">
                  <div className="px-3 py-2.5 mb-1 border-b border-border">
                    <p className="text-sm font-medium text-foreground truncate">{user.email}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{isAdmin ? 'Administrator' : 'Evaluator'}</p>
                  </div>

                  <button role="menuitem" type="button" onClick={run(onHome)} className={menuItem}>Your evaluations</button>

                  {/* Admin tools live in the bar on wide screens and in this menu on narrow ones. */}
                  {isAdmin && onOpenAccessRequests && (
                    <button role="menuitem" type="button" onClick={run(onOpenAccessRequests)} className={`${menuItem} md:hidden`}>Access requests</button>
                  )}
                  {isAdmin && onOpenPartnerOrgs && (
                    <button role="menuitem" type="button" onClick={run(onOpenPartnerOrgs)} className={`${menuItem} md:hidden`}>Partner orgs</button>
                  )}
                  {onChangePassword && (
                    <button role="menuitem" type="button" onClick={run(onChangePassword)} className={menuItem}>Change password</button>
                  )}

                  <div className="my-1 border-t border-border" />
                  <button role="menuitem" type="button" onClick={run(onLogout)} className={`${menuItem} text-destructive`}>Sign out</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
