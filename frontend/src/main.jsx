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
        card: {
          border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.08)',
          boxShadow: isDark ? '0 24px 56px rgba(0, 0, 0, 0.65)' : '0 16px 36px rgba(0, 0, 0, 0.12)',
          backdropFilter: 'blur(24px)',
        },
        modalContent: {
          border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.08)',
        },
        userButtonPopoverCard: {
          border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.08)',
          boxShadow: isDark ? '0 20px 48px rgba(0, 0, 0, 0.7)' : '0 12px 28px rgba(0, 0, 0, 0.12)',
        },
        userButtonPopoverMain: {
          background: isDark ? '#12121f' : '#ffffff',
        },
        userButtonPopoverFooter: {
          background: isDark ? '#0d0d17' : '#f8fafc',
        },
        socialButtonsBlockButton: {
          border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.1)',
        },
        formButtonPrimary: {
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
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
