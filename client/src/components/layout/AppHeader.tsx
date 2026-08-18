import { useState, useRef, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api';
import { useToast } from '../../context/ToastContext';
import { Bookmark, History, User as UserIcon, ShieldCheck, LogIn, Menu, X, LogOut, ChevronDown } from 'lucide-react';
import { cx } from '../../lib/utils';

/** MedScholar Main Logo */
function PubMedLogo({ className, white }: { className?: string; white?: boolean }) {
  const primary = white ? '#ffffff' : '#2563EB'; // vibrant blue
  const secondary = white ? 'rgba(255, 255, 255, 0.8)' : '#0EA5E9'; // sky blue
  const textPrimary = white ? '#ffffff' : '#0F172A'; // dark slate
  
  return (
    <svg className={className} width="220" height="44" viewBox="0 0 400 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={primary} />
          <stop offset="100%" stopColor={secondary} />
        </linearGradient>
        <filter id="logoGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Abstract Medical/Tech Icon */}
      <g transform="translate(5, 10)">
        <path d="M25 0 C45 0 55 10 55 30 C55 50 45 60 25 60 C5 60 -5 50 -5 30 C-5 10 5 0 25 0 Z" fill="url(#logoGrad)" fillOpacity="0.1" />
        <path d="M25 10 V50 M10 30 H40" stroke="url(#logoGrad)" strokeWidth="6" strokeLinecap="round" />
        <circle cx="40" cy="15" r="4" fill={secondary} filter="url(#logoGlow)" />
      </g>

      {/* Text 'MedScholar' */}
      <text x="70" y="52" fontFamily="system-ui, -apple-system, sans-serif" fontSize="42" fontWeight="800" letterSpacing="-1.5">
        <tspan fill={textPrimary}>Med</tspan>
        <tspan fill="url(#logoGrad)">Scholar</tspan>
      </text>
      
      {/* Decorative Accent */}
      <circle cx="288" cy="48" r="5" fill={primary} />
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
  const { notify } = useToast();
  const [isEnhancing, setIsEnhancing] = useState(false);

  useEffect(() => { setMenuOpen(false); setUserMenu(false); }, [loc.pathname]);
  useEffect(() => { setHeaderQuery(searchQuery); }, [searchQuery]);

  useEffect(() => {
    if (!userMenu) return;
    function handler(e: MouseEvent) { if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenu(false); }
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [userMenu]);

  const initials = user?.name ? user.name[0].toUpperCase() : (user?.email ? user.email[0].toUpperCase() : '?');

  async function handleEnhance() {
    if (!user) {
      notify('You must be logged in to enhance queries.', 'info');
      return;
    }
    if (!headerQuery.trim()) {
      notify('Please enter a query to enhance.', 'info');
      return;
    }
    setIsEnhancing(true);
    try {
      const res = await api.enhance.query({ query: headerQuery });
      setHeaderQuery(res.enhancedQuery);
      notify('Query enhanced successfully!', 'success');
    } catch (e: any) {
      notify(e.message || 'Failed to enhance query. Check your Gemini API key in profile.', 'error');
    } finally {
      setIsEnhancing(false);
    }
  }

  function handleHeaderSearch(e: React.FormEvent) {
    e.preventDefault();
    if (headerQuery.trim().length >= 3 && onSearch) {
      onSearch(headerQuery.trim());
    }
  }

  const navItems = [
    { to: `/${sessionStorage.getItem('lastSearch') || ''}`, label: 'Search', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg> },
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
            <PubMedLogo white />
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
                  <span className="pm-header__user-name">{user.name || user.email.split('@')[0]}</span>
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
          <div className="pm-header__search-inner container-wide" style={{ justifyContent: 'center' }}>
            <form className="pm-header__search-form" role="search" onSubmit={handleHeaderSearch} style={{ maxWidth: '1000px', flex: '1' }}>
                <div style={{ position: 'relative', flex: 1, display: 'flex' }}>
                  <input
                    className="pm-header__search-input"
                    value={headerQuery}
                    onChange={(e) => setHeaderQuery(e.target.value)}
                    placeholder="Search PubMed"
                    aria-label="Search"
                    style={{ width: '100%', borderRadius: 'var(--r-sm)', borderRight: '2px solid var(--pm-navy)', paddingRight: headerQuery ? '40px' : '16px' }}
                  />
                  {headerQuery && (
                    <div style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
                      <button type="button" className="pm-header__search-clear" onClick={() => setHeaderQuery('')} aria-label="Clear search" style={{ position: 'static', transform: 'none' }}>
                        <X size={18} />
                      </button>
                    </div>
                  )}
                </div>
                <button type="submit" className="pm-header__search-btn" style={{ marginLeft: '8px', borderRadius: 'var(--r-sm)' }}>Search</button>
                {user && (
                  <button 
                    type="button" 
                    onClick={handleEnhance} 
                    disabled={isEnhancing} 
                    title="Enhance with AI"
                    className="pm-header__enhance-btn"
                    style={{ marginLeft: '8px' }}
                  >
                    <span aria-hidden="true">{isEnhancing ? '...' : '✨'}</span>
                    <span className="pm-enhance-text">{isEnhancing ? 'Enhancing...' : 'AI Enhance'}</span>
                  </button>
                )}
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
