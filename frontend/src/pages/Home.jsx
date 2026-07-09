import { useState, useCallback, useEffect } from 'react';
import { shortenUrl as apiShorten, getUrlInfo, editUrl, deleteUrl } from '../services/api.js';
import { useLocalStorage } from '../hooks/useLocalStorage.js';

import UrlInput from '../components/UrlInput.jsx';
import ResultCard from '../components/ResultCard.jsx';
import QRCodeCard from '../components/QRCodeCard.jsx';
import Analytics from '../components/Analytics.jsx';
import RecentUrls from '../components/RecentUrls.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import BulkUpload from '../components/BulkUpload.jsx';

import styles from './Home.module.css';

const MAX_RECENT_STORAGE = 1000;

export default function Home({ theme, onToggleTheme, addToast }) {
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [recentUrls, setRecentUrls] = useLocalStorage('lynq-recent', []);

  const handleShorten = useCallback(async (url, customAlias = null, password = null, expiresInDays = null, maxClicks = null, title = null, tags = null) => {
    setIsLoading(true);
    setResult(null);

    try {
      const data = await apiShorten(url, customAlias, password, expiresInDays, maxClicks, title, tags);
      setResult(data);

      // Persist to recent URLs (deduplicate by shortCode)
      setRecentUrls((prev) => {
        const filtered = prev.filter((r) => r.shortCode !== data.shortCode);
        const existingItem = prev.find(p => p.shortCode === data.shortCode);
        return [
          { 
            shortCode: data.shortCode, 
            shortUrl: data.shortUrl, 
            originalUrl: data.originalUrl,
            editToken: data.editToken || existingItem?.editToken, // Preserve if we already own it
            title: data.title,
            tags: data.tags,
          },
          ...filtered,
        ].slice(0, MAX_RECENT_STORAGE);
      });

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
  }, [addToast, setRecentUrls]);

  const handleBulkAdded = useCallback((successfulResults) => {
    setRecentUrls((prev) => {
      const newItems = successfulResults.map(data => {
        const existingItem = prev.find(p => p.shortCode === data.shortCode);
        return {
          shortCode: data.shortCode,
          shortUrl: data.shortUrl,
          originalUrl: data.originalUrl,
          editToken: data.editToken || existingItem?.editToken, // Preserve if we already own it
          title: data.title,
          tags: data.tags,
        };
      }).reverse(); // latest on top

      const existingCodes = new Set(newItems.map(item => item.shortCode));
      const filteredPrev = prev.filter(r => !existingCodes.has(r.shortCode));

      return [...newItems, ...filteredPrev].slice(0, MAX_RECENT_STORAGE);
    });
    addToast(`Added ${successfulResults.length} link(s) to recent list`, 'success');
  }, [addToast, setRecentUrls]);

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

  // Poll for live analytics updates every 5 seconds while a result is shown
  useEffect(() => {
    if (!result?.shortCode) return;

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
    // Collect deletion promises for all items with an editToken
    const deletePromises = recentUrls
      .filter((item) => item.editToken)
      .map((item) => deleteUrl(item.shortCode, item.editToken));

    // Clear local UI instantly
    setRecentUrls([]);
    setResult(null);

    if (deletePromises.length > 0) {
      try {
        await Promise.allSettled(deletePromises);
        addToast('All recent URLs deleted permanently.', 'success');
      } catch (err) {
        console.error('Failed to clear all URLs from backend', err);
      }
    }
  }, [recentUrls, setRecentUrls, addToast]);

  const handleDeleteRecent = useCallback(async (shortCode) => {
    // Find the item to get its edit token
    const item = recentUrls.find(i => i.shortCode === shortCode);
    
    // First, remove it locally for snappy UI
    setRecentUrls((prev) => prev.filter((i) => i.shortCode !== shortCode));
    
    // Clear result if it's currently open
    setResult((prev) => prev?.shortCode === shortCode ? null : prev);

    if (item && item.editToken) {
      try {
        await deleteUrl(shortCode, item.editToken);
        addToast('URL deleted permanently.', 'success');
      } catch (err) {
        console.error('Failed to delete URL from backend', err);
        // It failed to delete remotely, but we still dropped it locally.
      }
    }
  }, [recentUrls, setRecentUrls, addToast]);

  const handleEditRecent = useCallback(async (shortCode, newUrl, editToken) => {
    try {
      await editUrl(shortCode, newUrl, editToken);
      setRecentUrls((prev) => prev.map((item) => 
        item.shortCode === shortCode ? { ...item, originalUrl: newUrl } : item
      ));
      addToast('URL updated successfully!', 'success');
      
      // Update result section if currently viewing the edited link
      setResult((prev) => {
        if (prev?.shortCode === shortCode) {
          return { ...prev, originalUrl: newUrl };
        }
        return prev;
      });
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

        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────── */}
      <main className={styles.main}>
        <div className={styles.hero}>
          <div className={styles.badge}>
            <span className={styles.badgeDot} />
            No login required · Instant · Free
          </div>

          <h1 className={styles.heading}>
            Shorten any URL
            <br />
            <span className={styles.headingGradient}>in one click</span>
          </h1>

          <p className={styles.subheading}>
            Paste your long link below and get a clean, shareable Lynq instantly.
          </p>
        </div>

        {/* ── Input Area ─────────────────────────────── */}
        <div className={styles.inputSection}>
          <UrlInput onShorten={handleShorten} isLoading={isLoading} />
        </div>

        {/* ── Bulk CSV Upload ─────────────────────────── */}
        <div className={styles.inputSection}>
          <BulkUpload onAdded={handleBulkAdded} />
        </div>

        {/* ── Result Area ────────────────────────────── */}
        {result && (
          <div className={styles.resultSection}>
            <div className={styles.resultMain}>
              <ResultCard result={result} onCopy={handleCopy} />
              <Analytics data={result} />
            </div>
            <QRCodeCard url={result.shortUrl} />
          </div>
        )}

        {/* ── Recent URLs ────────────────────────────── */}
        {recentUrls.length > 0 && (
          <div className={styles.recentSection}>
            <RecentUrls
              items={recentUrls}
              onSelect={handleSelectRecent}
              onClear={handleClearRecent}
              onDelete={handleDeleteRecent}
              onEdit={handleEditRecent}
            />
          </div>
        )}
      </main>

      {/* ── Footer ─────────────────────────────────── */}
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
    </div>
  );
}
