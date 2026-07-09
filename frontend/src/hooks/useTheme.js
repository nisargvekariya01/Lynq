import { useState, useEffect } from 'react';

/**
 * useTheme — toggles between 'dark' and 'light' themes.
 * Persists preference to localStorage and updates [data-theme] on <html>.
 */
export function useTheme() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('lynq-theme');
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('lynq-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  return { theme, toggleTheme };
}
