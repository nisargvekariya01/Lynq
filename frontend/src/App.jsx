import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { useTheme } from './hooks/useTheme.js';
import { useToast } from './hooks/useToast.js';
import { AuthProvider } from './context/AuthContext.jsx';
import { downloadAnalyticsCsv } from './services/api.js';
import Home from './pages/Home.jsx';
import Unlock from './pages/Unlock.jsx';
import Preview from './pages/Preview.jsx';
import RedirectHandler from './pages/RedirectHandler.jsx';
import NotFound from './pages/NotFound.jsx';
import Toast from './components/Toast.jsx';
import ConnectionStatus from './components/ConnectionStatus.jsx';
import CommandPalette from './components/CommandPalette.jsx';

function AppContent({ theme, toggleTheme, toasts, addToast, removeToast }) {
  const navigate = useNavigate();
  const [isCmdOpen, setIsCmdOpen] = useState(false);
  const [recentLinks, setRecentLinks] = useState([]);
  const [activeCode, setActiveCode] = useState(null);

  // Sync recent links from localStorage
  const refreshRecentLinks = useCallback(() => {
    try {
      const stored = localStorage.getItem('lynq-recent');
      if (stored) {
        setRecentLinks(JSON.parse(stored));
      }
    } catch {}
  }, []);

  useEffect(() => {
    refreshRecentLinks();
  }, [refreshRecentLinks, isCmdOpen]);

  // Global keydown listener for Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        refreshRecentLinks();
        setIsCmdOpen((prev) => !prev);
      }
    };

    const handleToggleCmd = () => {
      refreshRecentLinks();
      setIsCmdOpen((prev) => !prev);
    };

    const handleActiveCode = (e) => {
      if (e.detail) setActiveCode(e.detail);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('lynq-toggle-cmd', handleToggleCmd);
    window.addEventListener('lynq-active-code', handleActiveCode);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('lynq-toggle-cmd', handleToggleCmd);
      window.removeEventListener('lynq-active-code', handleActiveCode);
    };
  }, [refreshRecentLinks]);

  // Handlers for Command Palette actions
  const handleSelectLink = (link) => {
    if (window.location.pathname === '/') {
      window.dispatchEvent(new CustomEvent('lynq-select-link', { detail: link }));
    } else {
      navigate(`/?code=${encodeURIComponent(link.shortCode)}`);
    }
  };

  const handleFocusNewLink = () => {
    if (window.location.pathname !== '/') {
      navigate('/');
    }
    setTimeout(() => {
      document.getElementById('url-input')?.focus();
      document.getElementById('url-input')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleOpenPortfolio = () => {
    if (window.location.pathname !== '/') {
      navigate('/');
    }
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('lynq-open-portfolio'));
    }, 100);
  };

  return (
    <div className="app" data-theme={theme}>
      <Routes>
        <Route 
          path="/" 
          element={<Home theme={theme} onToggleTheme={toggleTheme} addToast={addToast} />} 
        />
        <Route 
          path="/unlock/:shortCode" 
          element={<Unlock theme={theme} onToggleTheme={toggleTheme} addToast={addToast} />} 
        />
        <Route 
          path="/preview/:shortCode" 
          element={<Preview theme={theme} onToggleTheme={toggleTheme} />} 
        />
        <Route 
          path="/404" 
          element={<NotFound />} 
        />
        <Route 
          path="/:shortCode" 
          element={<RedirectHandler />} 
        />
        <Route 
          path="*" 
          element={<NotFound />} 
        />
      </Routes>
      <ConnectionStatus />
      <Toast toasts={toasts} onRemove={removeToast} />
      <CommandPalette
        isOpen={isCmdOpen}
        onClose={() => setIsCmdOpen(false)}
        recentLinks={recentLinks}
        onSelectLink={handleSelectLink}
        onToggleTheme={toggleTheme}
        currentTheme={theme}
        onFocusNewLink={handleFocusNewLink}
        onOpenPortfolio={handleOpenPortfolio}
        currentActiveCode={activeCode}
        onExportCsv={downloadAnalyticsCsv}
        addToast={addToast}
      />
    </div>
  );
}

export default function App({ theme: propTheme, onToggleTheme: propToggleTheme }) {
  const themeHook = useTheme();
  const theme = propTheme || themeHook.theme;
  const toggleTheme = propToggleTheme || themeHook.toggleTheme;
  const { toasts, addToast, removeToast } = useToast();

  return (
    <BrowserRouter>
      <AuthProvider onClaimSuccess={(count) => addToast(`🎉 Synced your guest links to your account! (${count} links claimed)`, 'success')}>
        <AppContent
          theme={theme}
          toggleTheme={toggleTheme}
          toasts={toasts}
          addToast={addToast}
          removeToast={removeToast}
        />
      </AuthProvider>
    </BrowserRouter>
  );
}
