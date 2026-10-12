import { useState, useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SignInButton, UserButton, UserProfile } from '@clerk/clerk-react';
import { motion, AnimatePresence } from 'framer-motion';
import { dark } from '@clerk/themes';
import { shortenUrl as apiShorten, getUrlInfo, editUrl, deleteUrl, getUserLinks } from '../services/api.js';
import { useLocalStorage } from '../hooks/useLocalStorage.js';
import { useLynqAuth } from '../context/AuthContext.jsx';

import UrlInput from '../components/UrlInput.jsx';
import ResultCard from '../components/ResultCard.jsx';
import QRCodeCard from '../components/QRCodeCard.jsx';
import Analytics from '../components/Analytics.jsx';
import RecentUrls from '../components/RecentUrls.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import BulkUpload from '../components/BulkUpload.jsx';
import LandingSections, { LandingFooter } from '../components/LandingSections.jsx';

import styles from './Home.module.css';

const MAX_RECENT_STORAGE = 1000;

export default function Home({ theme, onToggleTheme, addToast }) {
  const { isSignedIn, hasClerk } = useLynqAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('links'); // 'links' | 'settings'
  const [userLinks, setUserLinks] = useState([]);
  const [recentUrls, setRecentUrls] = useLocalStorage('lynq-recent', []);

  // Load user links from backend when signed in
  useEffect(() => {
    if (isSignedIn) {
      getUserLinks()
        .then((res) => {
          if (res?.success && Array.isArray(res.links)) {
            setUserLinks(res.links);
          }
        })
        .catch((err) => {
          console.error('Failed to load user links:', err);
        });
    } else {
      setUserLinks([]);
    }
  }, [isSignedIn]);

  // Unified list of links (signed in cloud links + any pending guest links)
  const allLinks = useMemo(() => {
    if (!isSignedIn) {
      return recentUrls;
    }
    const existingCodes = new Set(userLinks.map((l) => l.shortCode));
    const extraRecent = recentUrls.filter((r) => !existingCodes.has(r.shortCode));
    return [...extraRecent, ...userLinks];
  }, [isSignedIn, userLinks, recentUrls]);

  const scrollToInput = useCallback(() => {
    const el = document.getElementById('shorten-input-container');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
      const input = el.querySelector('input');
      if (input) input.focus();
    }
  }, []);

  const handleShorten = useCallback(async (url, customAlias = null, password = null, expiresInDays = null, maxClicks = null, title = null, tags = null, routingRules = null) => {
    setIsLoading(true);
    setResult(null);

    try {
      const data = await apiShorten(url, customAlias, password, expiresInDays, maxClicks, title, tags, routingRules);
      setResult(data);

      const newLinkItem = { 
        shortCode: data.shortCode, 
        shortUrl: data.shortUrl, 
        originalUrl: data.originalUrl,
        editToken: data.editToken,
        title: data.title,
        tags: data.tags,
      };

      // Optimistically update both states instantly
      if (isSignedIn) {
        setUserLinks((prev) => [
          newLinkItem,
          ...prev.filter((r) => r.shortCode !== data.shortCode),
        ]);
      }
      setRecentUrls((prev) => [
        newLinkItem,
        ...prev.filter((r) => r.shortCode !== data.shortCode),
      ].slice(0, MAX_RECENT_STORAGE));

      addToast(
        data.isExisting
          ? '⚠️ Duplicate Detected — returning existing link'
          : '🎉 URL shortened successfully!',
        data.isExisting ? 'info' : 'success'
      );
      
      return true; // Indicate success for form clearing
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.message ||
        'Something went wrong. Please try again.';
      addToast(msg, 'error');
      return false; // Indicate failure
    } finally {
      setIsLoading(false);
    }
  }, [isSignedIn, addToast, setRecentUrls]);

  const handleBulkAdded = useCallback((successfulResults) => {
    const newItems = successfulResults.map(data => ({
      shortCode: data.shortCode,
      shortUrl: data.shortUrl,
      originalUrl: data.originalUrl,
      editToken: data.editToken,
      title: data.title,
      tags: data.tags,
    })).reverse();

    if (isSignedIn) {
      setUserLinks((prev) => {
        const existingCodes = new Set(newItems.map(item => item.shortCode));
        const filteredPrev = prev.filter(r => !existingCodes.has(r.shortCode));
        return [...newItems, ...filteredPrev];
      });
    }

    setRecentUrls((prev) => {
      const existingCodes = new Set(newItems.map(item => item.shortCode));
      const filteredPrev = prev.filter(r => !existingCodes.has(r.shortCode));
      return [...newItems, ...filteredPrev].slice(0, MAX_RECENT_STORAGE);
    });

    addToast(`Added ${successfulResults.length} link(s) to list`, 'success');
  }, [isSignedIn, addToast, setRecentUrls]);

  const handleSelectRecent = useCallback(async (item) => {
    // Set immediate cached state
    setResult({
      shortUrl: item.shortUrl,
      shortCode: item.shortCode,
      originalUrl: item.originalUrl,
      clicks: 0,
      isExisting: true,
    });

    // Fetch live stats
    try {
      const data = await getUrlInfo(item.shortCode);
      setResult((prev) => ({ ...prev, ...data, isExisting: true }));
    } catch (err) {
      console.error('Failed to fetch live stats', err);
    }
  }, []);

  // Listen for selection from Command Palette or ?code= parameter
  const codeParam = searchParams.get('code');
  useEffect(() => {
    if (codeParam) {
      setActiveTab('links');
      handleSelectRecent({ shortCode: codeParam });
      setSearchParams({}, { replace: true });
      setTimeout(() => {
        document.getElementById('result-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    }
  }, [codeParam, handleSelectRecent, setSearchParams]);

  useEffect(() => {
    const handlePaletteSelect = (e) => {
      if (e.detail) {
        setActiveTab('links');
        handleSelectRecent(e.detail);
        setTimeout(() => {
          document.getElementById('result-section')?.scrollIntoView({ behavior: 'smooth' });
        }, 150);
      }
    };

    const handlePortfolioOpen = () => {
      document.getElementById('recent-links-container')?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleOpenSettings = () => {
      setActiveTab('settings');
    };

    const handleOpenLinks = () => {
      setActiveTab('links');
    };

    window.addEventListener('lynq-select-link', handlePaletteSelect);
    window.addEventListener('lynq-open-portfolio', handlePortfolioOpen);
    window.addEventListener('lynq-open-settings', handleOpenSettings);
    window.addEventListener('lynq-open-links', handleOpenLinks);

    return () => {
      window.removeEventListener('lynq-select-link', handlePaletteSelect);
      window.removeEventListener('lynq-open-portfolio', handlePortfolioOpen);
      window.removeEventListener('lynq-open-settings', handleOpenSettings);
      window.removeEventListener('lynq-open-links', handleOpenLinks);
    };
  }, [handleSelectRecent]);

  // Poll for live analytics updates every 5 seconds while a result is shown
  useEffect(() => {
    if (!result?.shortCode) {
      window.dispatchEvent(new CustomEvent('lynq-active-code', { detail: null }));
      return;
    }

    window.dispatchEvent(new CustomEvent('lynq-active-code', { detail: result.shortCode }));

    const interval = setInterval(async () => {
      try {
        const data = await getUrlInfo(result.shortCode);
        setResult((prev) => ({ ...prev, ...data }));
      } catch (err) {
        // Ignore polling errors quietly
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [result?.shortCode]);

  const handleClearRecent = useCallback(async () => {
    const deletePromises = allLinks
      .filter((item) => item.editToken)
      .map((item) => deleteUrl(item.shortCode, item.editToken));

    // Instant local UI clear
    setUserLinks([]);
    setRecentUrls([]);
    setResult(null);

    if (deletePromises.length > 0) {
      try {
        await Promise.allSettled(deletePromises);
        addToast('All links deleted permanently.', 'success', 2000);
      } catch (err) {
        console.error('Failed to clear all URLs from backend', err);
      }
    }
  }, [allLinks, setRecentUrls, addToast]);

  const handleDeleteRecent = useCallback(async (shortCode) => {
    const item = allLinks.find((i) => i.shortCode === shortCode);
    
    // FAST OPTIMISTIC UI: Instantly remove locally in 0ms
    setUserLinks((prev) => prev.filter((i) => i.shortCode !== shortCode));
    setRecentUrls((prev) => prev.filter((i) => i.shortCode !== shortCode));
    setResult((prev) => prev?.shortCode === shortCode ? null : prev);

    // Background delete execution
    if (item?.editToken) {
      try {
        await deleteUrl(shortCode, item.editToken);
        addToast('Link deleted permanently.', 'success', 2000);
      } catch (err) {
        console.error('Failed to delete URL from backend', err);
      }
    } else if (isSignedIn) {
      try {
        await deleteUrl(shortCode, null);
        addToast('Link deleted permanently.', 'success', 2000);
      } catch (err) {
        console.error('Failed to delete URL from backend', err);
      }
    }
  }, [allLinks, isSignedIn, setRecentUrls, addToast]);

  const handleEditRecent = useCallback(async (shortCode, newUrl, editToken) => {
    // Fast optimistic UI update
    setUserLinks((prev) => prev.map((item) => 
      item.shortCode === shortCode ? { ...item, originalUrl: newUrl } : item
    ));
    setRecentUrls((prev) => prev.map((item) => 
      item.shortCode === shortCode ? { ...item, originalUrl: newUrl } : item
    ));
    
    setResult((prev) => {
      if (prev?.shortCode === shortCode) {
        return { ...prev, originalUrl: newUrl };
      }
      return prev;
    });

    try {
      await editUrl(shortCode, newUrl, editToken);
      addToast('URL updated successfully!', 'success', 2000);
      return true;
    } catch (err) {
      addToast(err?.response?.data?.error || 'Failed to edit URL.', 'error');
      return false;
    }
  }, [setRecentUrls, addToast]);

  const handleCopy = useCallback(() => {
    addToast('✓ Short URL copied to clipboard!', 'success', 2500);
  }, [addToast]);

  return (
    <div className={styles.page}>
      {/* ── Header ─────────────────────────────────── */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.logo}>
            <div className={styles.logoMark}>
              <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
                <rect width="32" height="32" rx="8" fill="url(#logoGrad)"/>
                <g transform="translate(6.4, 6.4) scale(0.8)" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </g>
                <defs>
                  <linearGradient id="logoGrad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#6366f1"/><stop offset="1" stopColor="#8b5cf6"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <span className={styles.logoText}>Lynq</span>
          </div>


          <div className={styles.headerRight}>
            {hasClerk && (
              isSignedIn ? (
                <UserButton
                  afterSignOutUrl="/"
                  appearance={{
                    baseTheme: theme === 'dark' ? dark : undefined,
                  }}
                />
              ) : (
                <SignInButton mode="modal" oauthFlow="popup">
                  <button type="button" className={styles.signInBtn}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                      <polyline points="10 17 15 12 10 7" />
                      <line x1="15" y1="12" x2="3" y2="12" />
                    </svg>
                    <span>Sign In</span>
                  </button>
                </SignInButton>
              )
            )}
            <button
              type="button"
              className={styles.cmdPaletteBtn}
              onClick={() => window.dispatchEvent(new CustomEvent('lynq-toggle-cmd'))}
              title="Search links or commands (Cmd+K / Ctrl+K)"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <span className={styles.cmdPaletteBtnText}>Search</span>
              <kbd className={styles.cmdKbd}>
                {typeof navigator !== 'undefined' && navigator.platform?.toUpperCase().includes('MAC') ? '⌘K' : 'Ctrl+K'}
              </kbd>
            </button>
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          </div>
        </div>
      </header>

      {/* ── Main Content Area ────────────────────────── */}
      <main className={`${styles.main} ${!isSignedIn ? styles.mainLanding : ''}`}>
        {!isSignedIn ? (
          /* ── Landing Page Two-Column Hero ───────────── */
          <div className={styles.heroGrid}>
            <div className={styles.heroLeft}>
              <div className={styles.heroLeftBadge}>
                <span className={styles.badgeDot} />
                Next-Gen Link Platform · Instant · Free
              </div>

              <h1 className={styles.heroTitle}>
                URL shortener
                <br />
                <span className={styles.heroTitleGradient}>with analytics</span>
              </h1>

              <p className={styles.heroDesc}>
                Free custom link shortener with real-time telemetry, geo-routing, and smart link targeting to optimize every redirect.
              </p>

              <div className={styles.heroCtaRow}>
                {hasClerk ? (
                  <SignInButton mode="modal" oauthFlow="popup">
                    <button type="button" className={styles.heroPrimaryBtn}>
                      <span>Get Started Free</span>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </button>
                  </SignInButton>
                ) : (
                  <button type="button" className={styles.heroPrimaryBtn} onClick={scrollToInput}>
                    <span>Shorten Link Now</span>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </button>
                )}

                <button 
                  type="button" 
                  className={styles.heroSecondaryBtn}
                  onClick={() => document.getElementById('showcase')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none" />
                  </svg>
                  <span>See Live Demo</span>
                </button>
              </div>

              <div className={styles.heroTrustBullets}>
                <div className={styles.heroTrustItem}>
                  <span className={styles.heroCheckIcon}>✓</span> Free forever plan
                </div>
                <div className={styles.heroTrustItem}>
                  <span className={styles.heroCheckIcon}>✓</span> No credit card required
                </div>
                <div className={styles.heroTrustItem}>
                  <span className={styles.heroCheckIcon}>✓</span> &lt;15ms redirect latency
                </div>
              </div>
            </div>

            <div className={styles.heroRight} id="shorten-input-container">
              <div className={styles.heroRightCard}>
                <UrlInput onShorten={handleShorten} isLoading={isLoading} />
              </div>
            </div>
          </div>
        ) : (
          /* ── Logged In Experience with Smooth Sliding Page Switcher ───── */
          <>
            {/* ── Top Page Slider with Smooth Pill Shift ── */}
            <div className={styles.sliderWrapper}>
              <div className={styles.pageSlider} role="tablist" aria-label="Dashboard views">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'links'}
                  className={`${styles.sliderBtn} ${activeTab === 'links' ? styles.sliderBtnActive : ''}`}
                  onClick={() => setActiveTab('links')}
                >
                  {activeTab === 'links' && (
                    <motion.div
                      layoutId="activeSliderPill"
                      className={styles.sliderPill}
                      transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                    />
                  )}
                  <span className={styles.sliderBtnContent}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                    <span>Your links</span>
                  </span>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'settings'}
                  className={`${styles.sliderBtn} ${activeTab === 'settings' ? styles.sliderBtnActive : ''}`}
                  onClick={() => setActiveTab('settings')}
                >
                  {activeTab === 'settings' && (
                    <motion.div
                      layoutId="activeSliderPill"
                      className={styles.sliderPill}
                      transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                    />
                  )}
                  <span className={styles.sliderBtnContent}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    <span>User Setting</span>
                  </span>
                </button>
              </div>
            </div>

            {/* ── View Content with Smooth Shift Animation ── */}
            <AnimatePresence mode="wait">
              {activeTab === 'links' ? (
                <motion.div
                  key="tab-links"
                  initial={{ opacity: 0, x: -18 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -18 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className={styles.tabContentWrapper}
                >
                  {/* ── Short Statement Headline ─────────── */}
                  <div className={styles.dashboardHero}>
                    <h2 className={styles.dashboardHeadline}>
                      Shorten URLs in <span className={styles.headingGradient}>a few simple steps</span>
                    </h2>
                    <p className={styles.dashboardSubtext}>
                      Create fast, trackable short links with real-time telemetry and custom options.
                    </p>
                  </div>

                  {/* ── Logged In Link Shortening Form ───── */}
                  <div className={styles.inputSection} id="shorten-input-container">
                    <UrlInput onShorten={handleShorten} isLoading={isLoading} />
                  </div>

                  {/* ── Bulk CSV Upload ─────────────────── */}
                  <div className={styles.inputSection}>
                    <BulkUpload onAdded={handleBulkAdded} />
                  </div>

                  {/* ── Links Section (Directly below Bulk CSV Upload, max 5-6 links) ── */}
                  {allLinks.length > 0 && (
                    <div className={styles.recentSection} id="recent-links-container">
                      <RecentUrls
                        items={allLinks}
                        onSelect={handleSelectRecent}
                        onClear={handleClearRecent}
                        onDelete={handleDeleteRecent}
                        onEdit={handleEditRecent}
                        isSignedIn={isSignedIn}
                      />
                    </div>
                  )}

                  {/* ── Result Area ────────────────────── */}
                  {result && (
                    <div className={styles.resultSection} id="result-section">
                      <div className={styles.resultMain}>
                        <ResultCard result={result} onCopy={handleCopy} />
                        <Analytics data={result} />
                      </div>
                      <QRCodeCard url={result.shortUrl} />
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="tab-settings"
                  initial={{ opacity: 0, x: 18 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 18 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className={styles.tabContentWrapper}
                >
                  <div className={styles.settingsSection}>
                    <div className={styles.settingsHero}>
                      <h2 className={styles.settingsHeadline}>
                        User <span className={styles.headingGradient}>Setting</span>
                      </h2>
                      <p className={styles.settingsSubtext}>
                        Manage your account profile, security credentials, and authentication preferences.
                      </p>
                    </div>

                    <div className={styles.userProfileWrapper}>
                      {hasClerk ? (
                        <UserProfile
                          routing="hash"
                          appearance={{
                            baseTheme: theme === 'dark' ? dark : undefined,
                          }}
                        />
                      ) : (
                        <div className={styles.mockSettingsCard}>
                          <p>Account settings are managed via your authentication provider.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {/* ── Guest Only: Bulk Upload, Links, Results & Landing ── */}
        {!isSignedIn && (
          <>
            <div className={styles.inputSection}>
              <BulkUpload onAdded={handleBulkAdded} />
            </div>

            {allLinks.length > 0 && (
              <div className={styles.recentSection} id="recent-links-container">
                <RecentUrls
                  items={allLinks}
                  onSelect={handleSelectRecent}
                  onClear={handleClearRecent}
                  onDelete={handleDeleteRecent}
                  onEdit={handleEditRecent}
                  isSignedIn={false}
                />
              </div>
            )}

            {result && (
              <div className={styles.resultSection} id="result-section">
                <div className={styles.resultMain}>
                  <ResultCard result={result} onCopy={handleCopy} />
                  <Analytics data={result} />
                </div>
                <QRCodeCard url={result.shortUrl} />
              </div>
            )}

            <LandingSections hasClerk={hasClerk} onScrollToInput={scrollToInput} />
          </>
        )}
      </main>

      {/* ── Footer ─────────────────────────────────── */}
      {!isSignedIn ? (
        <LandingFooter />
      ) : (
        <footer className={styles.footer}>
          <div className={styles.footerInner}>
            <span>Built with ⚡ by Lynq</span>
            <span className={styles.dot}>·</span>
            <span>Open Source URL Shortener</span>
            <span className={styles.dot}>·</span>
            <span>Redis-powered</span>
            <span className={styles.dot}>·</span>
            <span>Blazing fast</span>
            <span className={styles.dot}>·</span>
            <span>No Ads. No Tracking.</span>
          </div>
        </footer>
      )}
    </div>
  );
}
