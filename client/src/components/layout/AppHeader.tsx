import { useState, useRef, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Bookmark, History, User as UserIcon, ShieldCheck, LogIn, Menu, X, LogOut, ChevronDown } from 'lucide-react';
import { cx } from '../../lib/utils';

/** PubMed-style SVG book logo mark */
function PubMedLogo({ className, white }: { className?: string; white?: boolean }) {
  const fill = white ? '#fff' : '#20558a';
  return (
    <svg className={className} width="130" height="40" viewBox="0 0 280 80" fill="none" aria-hidden="true">
      <text x="0" y="58" fontFamily="Source Sans 3, Source Sans Pro, Arial, sans-serif" fontSize="56" fontWeight="700" fill={fill}>
        Pub
      </text>
      {/* Book icon between Pub and Med */}
      <g transform="translate(118, 8)">
        <path d="M10 0 L10 55 M10 55 C10 55 25 45 40 55 M10 55 C10 55 -5 45 -20 55 M10 0 C10 0 25 -5 40 5 L40 55 M10 0 C10 0 -5 -5 -20 5 L-20 55" stroke={fill} strokeWidth="3" fill="none"/>
      </g>
      <text x="158" y="58" fontFamily="Source Sans 3, Source Sans Pro, Arial, sans-serif" fontSize="56" fontWeight="700" fill={fill}>
        Med
      </text>
      <text x="262" y="30" fontFamily="Source Sans 3, Source Sans Pro, Arial, sans-serif" fontSize="18" fontWeight="400" fill={fill}>®</text>
    </svg>
  );
}

/** MedSearch Logo */
function MedSearchLogo() {
  return (
    <svg width="42" height="42" viewBox="0 0 42 42" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="40" height="40" rx="3" stroke="#fff" strokeWidth="2" fill="none"/>
      <text x="7" y="28" fontFamily="Source Sans 3, Arial, sans-serif" fontSize="18" fontWeight="700" fill="#fff">MS</text>
    </svg>
  );
}

interface AppHeaderProps {
  compact?: boolean;
  searchQuery?: string;
  onSearch?: (query: string) => void;
}

export function AppHeader({ compact, searchQuery = '', onSearch }: AppHeaderProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [headerQuery, setHeaderQuery] = useState(searchQuery);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { setMenuOpen(false); setUserMenu(false); }, [loc.pathname]);
  useEffect(() => { setHeaderQuery(searchQuery); }, [searchQuery]);

  useEffect(() => {
    if (!userMenu) return;
    function handler(e: MouseEvent) { if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenu(false); }
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [userMenu]);

  const initials = user?.email ? user.email[0].toUpperCase() : '?';

  function handleHeaderSearch(e: React.FormEvent) {
    e.preventDefault();
    if (headerQuery.trim().length >= 3 && onSearch) {
      onSearch(headerQuery.trim());
    }
  }

  const navItems = [
    ...(user ? [{ to: '/bookmarks', label: 'Bookmarks', icon: <Bookmark size={15} aria-hidden="true" /> }] : []),
    ...(user ? [{ to: '/history', label: 'History', icon: <History size={15} aria-hidden="true" /> }] : []),
    ...(user?.role === 'admin' ? [{ to: '/admin', label: 'Admin', icon: <ShieldCheck size={15} aria-hidden="true" /> }] : []),
  ];

  return (
    <header className="pm-header" role="banner">
      {/* Row 1: Navy top bar */}
      <div className="pm-header__top">
        <div className="pm-header__top-inner container-wide">
          <NavLink to="/" className="pm-header__nlm-link" end>
            <MedSearchLogo />
            <div className="pm-header__nlm-text">
              <span className="pm-header__nlm-name">MedSearch Platform</span>
              <span className="pm-header__nlm-sub">Advanced Semantic Search Engine</span>
            </div>
          </NavLink>

          <div className="pm-header__actions">
            {/* Desktop nav items */}
            <nav className="pm-header__nav-desktop" aria-label="Primary">
              {navItems.map((it) => (
                <NavLink key={it.to} to={it.to} className={({ isActive }) => cx('pm-header__nav-item', isActive && 'pm-header__nav-item--active')}>
                  {it.icon}<span>{it.label}</span>
                </NavLink>
              ))}
            </nav>

            {user ? (
              <div ref={userMenuRef} style={{ position: 'relative' }}>
                <button className="pm-header__user-btn" aria-haspopup="menu" aria-expanded={userMenu} onClick={() => setUserMenu((v) => !v)}>
                  <span className="pm-header__avatar">{initials}</span>
                  <span className="pm-header__user-name">{user.email.split('@')[0]}</span>
                  <ChevronDown size={14} aria-hidden="true" />
                </button>
                {userMenu && (
                  <div role="menu" className="user-menu">
                    <div className="user-menu__head">
                      <div className="user-menu__email">{user.email}</div>
                      <div className="user-menu__role">{user.role}</div>
                    </div>
                    <div className="user-menu__divider" />
                    <button className="user-menu__item" role="menuitem" onClick={() => { setUserMenu(false); navigate('/profile'); }}>
                      <UserIcon size={16} /> <span>Profile & settings</span>
                    </button>
                    <button className="user-menu__item user-menu__item--danger" role="menuitem" onClick={async () => { setUserMenu(false); await logout(); navigate('/login'); }}>
                      <LogOut size={16} /> <span>Sign out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <NavLink to="/login" className="pm-header__login-btn"><LogIn size={15} /> Log in</NavLink>
            )}

            {/* Mobile menu toggle */}
            <button className="pm-header__menu-btn" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)}>
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </div>

      {/* Row 2: Search bar (compact mode only — i.e., after search or on inner pages) */}
      {compact && (
        <div className="pm-header__search-row">
          <div className="pm-header__search-inner container-wide">
            <NavLink to="/" className="pm-header__logo-link" aria-label="MedSearch home" end>
              <PubMedLogo />
            </NavLink>
            <form className="pm-header__search-form" role="search" onSubmit={handleHeaderSearch}>
              <input
                type="text"
                className="pm-header__search-input"
                value={headerQuery}
                onChange={(e) => setHeaderQuery(e.target.value)}
                placeholder="Search PubMed"
                aria-label="Search"
              />
              {headerQuery && (
                <button type="button" className="pm-header__search-clear" onClick={() => setHeaderQuery('')} aria-label="Clear search">
                  <X size={18} />
                </button>
              )}
              <button type="submit" className="pm-header__search-btn">Search</button>
            </form>

          </div>
        </div>
      )}

      {/* Mobile menu */}
      {menuOpen && (
        <nav className="pm-header__mobile-nav" aria-label="Primary mobile">
          <NavLink to="/" className="pm-header__mobile-item" end>Search</NavLink>
          {navItems.map((it) => (
            <NavLink key={it.to} to={it.to} className="pm-header__mobile-item">
              {it.icon}<span>{it.label}</span>
            </NavLink>
          ))}
          {!user && (
            <>
              <NavLink to="/login" className="pm-header__mobile-item"><LogIn size={16} /> Sign in</NavLink>
              <NavLink to="/signup" className="pm-header__mobile-item">Create account</NavLink>
            </>
          )}
          {user && (
            <>
              <NavLink to="/profile" className="pm-header__mobile-item"><UserIcon size={16} /> Profile</NavLink>
              <button className="pm-header__mobile-item" onClick={async () => { await logout(); navigate('/login'); }}><LogOut size={16} /> Sign out</button>
            </>
          )}
        </nav>
      )}
    </header>
  );
}

export { PubMedLogo };

export function FocusOnRoute({ children }: { children: import('react').ReactNode }) {
  const { pathname } = useLocation();
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => { ref.current?.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'smooth' }); }, [pathname]);
  return <main id="main" tabIndex={-1} ref={ref as import('react').RefObject<HTMLElement>} className="page">{children}</main>;
}
