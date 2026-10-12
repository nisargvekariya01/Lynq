import React, { useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import { dark } from '@clerk/themes';
import App from './App.jsx';
import { useTheme } from './hooks/useTheme.js';
import './index.css';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

function Root() {
  const { theme, toggleTheme } = useTheme();

  const clerkAppearance = useMemo(() => {
    const isDark = theme === 'dark';
    return {
      baseTheme: isDark ? dark : undefined,
      layout: {
        unsafe_disableDevelopmentModeWarnings: true,
        logoPlacement: 'none',
      },
      variables: {
        colorPrimary: '#6366f1',
        colorBackground: isDark ? '#12121f' : '#ffffff',
        colorInputBackground: isDark ? '#1a1a2e' : '#f8fafc',
        colorInputText: isDark ? '#f1f5f9' : '#0f172a',
        colorText: isDark ? '#f1f5f9' : '#0f172a',
        colorTextSecondary: isDark ? '#94a3b8' : '#64748b',
        borderRadius: '0.85rem',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      },
      elements: {
        footer: {
          display: 'none !important',
        },
        footerPages: {
          display: 'none !important',
        },
        card: {
          border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.08)',
          boxShadow: isDark ? '0 24px 56px rgba(0, 0, 0, 0.65)' : '0 16px 36px rgba(0, 0, 0, 0.12)',
          backdropFilter: 'blur(24px)',
          borderRadius: '1.25rem',
          overflow: 'hidden',
        },
        modalContent: {
          border: 'none',
          background: 'transparent',
          boxShadow: 'none',
          borderRadius: '1.25rem',
          overflow: 'hidden',
        },
        userButtonPopoverCard: {
          border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.08)',
          boxShadow: isDark ? '0 20px 48px rgba(0, 0, 0, 0.7)' : '0 12px 28px rgba(0, 0, 0, 0.12)',
        },
        userButtonPopoverMain: {
          background: isDark ? '#12121f' : '#ffffff',
        },
        userButtonPopoverFooter: {
          display: 'none !important',
        },
        userButtonPopoverActionButton__manageAccount: {
          display: 'none !important',
        },
        socialButtonsBlockButton: {
          border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.1)',
        },
        formButtonPrimary: {
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
        },
        userProfileRoot: {
          width: '100% !important',
          maxWidth: '100% !important',
        },
        userProfileCard: {
          width: '100% !important',
          maxWidth: '100% !important',
          border: isDark ? '1px solid rgba(255, 255, 255, 0.10)' : '1px solid rgba(0, 0, 0, 0.08)',
          boxShadow: isDark ? '0 20px 50px rgba(0, 0, 0, 0.5)' : '0 12px 32px rgba(0, 0, 0, 0.08)',
          borderRadius: '1.25rem',
        },
        userProfileNavbar: {
          background: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)',
          borderRight: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)',
        },
        userProfileNavbarButton: {
          borderRadius: '0.65rem',
        },
        userProfileNavbarButton__active: {
          background: 'rgba(99, 102, 241, 0.16) !important',
          color: '#818cf8 !important',
        },
        userProfileNavbarFooter: {
          display: 'none !important',
        },
        navbarFooter: {
          display: 'none !important',
        },
        profileSection__footer: {
          display: 'none !important',
        },
        badge: {
          display: 'none !important',
        },
      },
    };
  }, [theme]);

  return (
    <React.StrictMode>
      {PUBLISHABLE_KEY ? (
        <ClerkProvider
          publishableKey={PUBLISHABLE_KEY}
          afterSignOutUrl="/"
          appearance={clerkAppearance}
        >
          <App theme={theme} onToggleTheme={toggleTheme} />
        </ClerkProvider>
      ) : (
        <App theme={theme} onToggleTheme={toggleTheme} />
      )}
    </React.StrictMode>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Root />);
