import { useState, useEffect, useCallback } from 'react';

/**
 * useTheme — provides 'dark' and 'light' themes with Chrome default matching
 * and circular spread-out (dark -> light) and spread-in (light -> dark) animations.
 */
export function useTheme() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('lynq-theme');
    if (saved === 'dark' || saved === 'light') return saved;
    // Default to Chrome / system theme
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    return 'dark';
  });

  // Keep in sync with Chrome/system theme if user hasn't explicitly set a preference
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
    const handleSystemThemeChange = (e) => {
      const saved = localStorage.getItem('lynq-theme');
      if (!saved) {
        const autoTheme = e.matches ? 'light' : 'dark';
        setTheme(autoTheme);
        document.documentElement.setAttribute('data-theme', autoTheme);
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleSystemThemeChange);
      return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
    }
  }, []);

  // Update root attribute
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(async (event) => {
    const isDark = theme === 'dark';
    const nextTheme = isDark ? 'light' : 'dark';

    // 1. Calculate origin coordinate (center of toggle button or click point)
    let x = window.innerWidth - 45;
    let y = 30;

    if (event && typeof event.clientX === 'number' && event.clientX > 0) {
      x = Math.round(event.clientX);
      y = Math.round(event.clientY);
    } else {
      const toggleEl = document.querySelector('[class*="toggle"]') || document.querySelector('.theme-toggle');
      if (toggleEl) {
        const rect = toggleEl.getBoundingClientRect();
        x = Math.round(rect.left + rect.width / 2);
        y = Math.round(rect.top + rect.height / 2);
      }
    }

    // Radius required to cover entire viewport from origin
    const endRadius = Math.ceil(
      Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      )
    );

    // Save user preference
    localStorage.setItem('lynq-theme', nextTheme);

    // 2. Animate with View Transitions API if supported
    if (typeof document !== 'undefined' && document.startViewTransition) {
      const transitionType = isDark ? 'spread-out' : 'spread-in';
      document.documentElement.setAttribute('data-theme-transition', transitionType);

      try {
        const transition = document.startViewTransition(() => {
          setTheme(nextTheme);
          document.documentElement.setAttribute('data-theme', nextTheme);
        });

        await transition.ready;

        if (isDark) {
          // Dark -> Light: Spread out (light circle expands outward from button)
          const animation = document.documentElement.animate(
            {
              clipPath: [
                `circle(0px at ${x}px ${y}px)`,
                `circle(${endRadius}px at ${x}px ${y}px)`,
              ],
            },
            {
              duration: 650,
              easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
              pseudoElement: '::view-transition-new(root)',
            }
          );
          await animation.finished;
        } else {
          // Light -> Dark: Spread in (old light circle contracts inward toward button)
          const animation = document.documentElement.animate(
            {
              clipPath: [
                `circle(${endRadius}px at ${x}px ${y}px)`,
                `circle(0px at ${x}px ${y}px)`,
              ],
            },
            {
              duration: 650,
              easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
              pseudoElement: '::view-transition-old(root)',
            }
          );
          await animation.finished;
        }
      } catch (err) {
        setTheme(nextTheme);
        document.documentElement.setAttribute('data-theme', nextTheme);
      } finally {
        document.documentElement.removeAttribute('data-theme-transition');
      }
    } else {
      // 3. Circular ripple fallback for older browsers
      const overlay = document.createElement('div');
      overlay.style.position = 'fixed';
      overlay.style.inset = '0';
      overlay.style.zIndex = '9999999';
      overlay.style.pointerEvents = 'none';

      if (isDark) {
        // Spread out to light
        overlay.style.backgroundColor = '#f8fafc';
        document.body.appendChild(overlay);
        const anim = overlay.animate(
          [
            { clipPath: `circle(0px at ${x}px ${y}px)` },
            { clipPath: `circle(${endRadius}px at ${x}px ${y}px)` }
          ],
          {
            duration: 650,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)'
          }
        );
        anim.onfinish = () => {
          setTheme(nextTheme);
          document.documentElement.setAttribute('data-theme', nextTheme);
          overlay.remove();
        };
      } else {
        // Spread in to dark
        overlay.style.backgroundColor = '#090d16';
        document.body.appendChild(overlay);
        const anim = overlay.animate(
          [
            { clipPath: `circle(0px at ${x}px ${y}px)` },
            { clipPath: `circle(${endRadius}px at ${x}px ${y}px)` }
          ],
          {
            duration: 650,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)'
          }
        );
        anim.onfinish = () => {
          setTheme(nextTheme);
          document.documentElement.setAttribute('data-theme', nextTheme);
          overlay.remove();
        };
      }
    }
  }, [theme]);

  return { theme, toggleTheme };
}
