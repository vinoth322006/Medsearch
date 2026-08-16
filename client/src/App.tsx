import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { AppHeader, FocusOnRoute } from './components/layout/AppHeader';
import { AppFooter } from './components/layout/AppFooter';
import { SearchPage } from './pages/SearchPage';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { BookmarksPage } from './pages/BookmarksPage';
import { HistoryPage } from './pages/HistoryPage';
import { ProfilePage } from './pages/ProfilePage';
import { AdminPage } from './pages/AdminPage';
import { Spinner } from './components/ui/Spinner';
import { ReactNode } from 'react';

function Protected({ children, role }: { children: ReactNode; role?: 'admin' }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--s-12)' }}><Spinner size={28} /></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (role === 'admin' && user.role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  const location = useLocation();
  const isHomepage = location.pathname === '/';
  const hasSearchQuery = new URLSearchParams(location.search).has('q');

  // Show compact header on all pages except homepage without a query
  const showCompact = !isHomepage || hasSearchQuery;

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">Skip to main content</a>
      <AppHeader compact={showCompact} />
      <FocusOnRoute>
        <Routes>
          <Route path="/" element={<SearchPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/bookmarks" element={<Protected><BookmarksPage /></Protected>} />
          <Route path="/history" element={<Protected><HistoryPage /></Protected>} />
          <Route path="/profile" element={<Protected><ProfilePage /></Protected>} />
          <Route path="/admin" element={<Protected role="admin"><AdminPage /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </FocusOnRoute>
      <AppFooter />
    </div>
  );
}
