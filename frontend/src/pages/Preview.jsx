import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getUrlInfo, checkStatus } from '../services/api.js';
import ThemeToggle from '../components/ThemeToggle.jsx';
import homeStyles from './Home.module.css';
import styles from './Preview.module.css';

export default function Preview({ theme, onToggleTheme }) {
  const { shortCode } = useParams();
  const navigate = useNavigate();
  const [info, setInfo] = useState(null);
  const [status, setStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [infoData, statusData] = await Promise.all([
          getUrlInfo(shortCode),
          checkStatus(shortCode),
        ]);
        setInfo(infoData);
        setStatus(statusData);
      } catch (err) {
        setError(err?.response?.data?.error || 'This link was not found or has expired.');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [shortCode]);

  const handleVisit = () => {
    window.open(info?.originalUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className={styles.page}>
      <header className={homeStyles.header}>
        <div className={homeStyles.headerInner}>
          <div className={homeStyles.logo} style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>
            <div className={homeStyles.logoMark}>
              <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
                <rect width="32" height="32" rx="8" fill="url(#logoGradPrev)"/>
                <text x="16" y="22" fontFamily="Inter,sans-serif" fontSize="16" fontWeight="900" textAnchor="middle" fill="white">L</text>
                <defs>
                  <linearGradient id="logoGradPrev" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#6366f1"/><stop offset="1" stopColor="#8b5cf6"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <span className={homeStyles.logoText}>Lynq</span>
          </div>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
      </header>

      <main className={styles.main}>
        {isLoading && (
          <div className={styles.card}>
            <div className={styles.loadingState}>
              <span className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
              <p>Checking link…</p>
            </div>
          </div>
        )}

        {error && (
          <div className={styles.card}>
            <div className={styles.errorState}>
              <span className={styles.errorIcon}>🔗</span>
              <h2>Link Not Found</h2>
              <p>{error}</p>
              <Link to="/" className={styles.backBtn}>← Back to Lynq</Link>
            </div>
          </div>
        )}

        {!isLoading && !error && info && (
          <div className={styles.card}>
            {/* Status badge */}
            <div className={`${styles.statusBadge} ${status?.isAlive ? styles.statusAlive : styles.statusBroken}`}>
              <span className={styles.statusDot} />
              {status?.isAlive
                ? `Active — responded in ${status.responseTime}ms`
                : status?.statusCode === 408
                  ? 'Timed Out — destination is too slow'
                  : status?.statusCode === 0
                    ? 'Unreachable — destination is offline'
                    : `Broken — server returned ${status?.statusCode}`
              }
            </div>

            {/* Link info */}
            <div className={styles.body}>
              <div className={styles.previewIcon}>🔗</div>

              <h1 className={styles.title}>
                {info.shortUrl?.replace('http://', '').replace('https://', '')}
              </h1>

              <div className={styles.destinationBox}>
                <span className={styles.destinationLabel}>Destination</span>
                <a
                  href={info.originalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.destinationUrl}
                >
                  {info.originalUrl.length > 80
                    ? info.originalUrl.slice(0, 80) + '…'
                    : info.originalUrl}
                </a>
              </div>

              {/* Stats row */}
              <div className={styles.statsRow}>
                <div className={styles.stat}>
                  <span className={styles.statValue}>{info.clicks ?? 0}</span>
                  <span className={styles.statLabel}>Clicks</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statValue}>{info.uniqueVisitors ?? 0}</span>
                  <span className={styles.statLabel}>Unique</span>
                </div>
                {info.createdAt && (
                  <div className={styles.stat}>
                    <span className={styles.statValue}>
                      {new Date(info.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    <span className={styles.statLabel}>Created</span>
                  </div>
                )}
              </div>

              {/* Broken warning */}
              {!status?.isAlive && (
                <div className={styles.brokenWarning}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  The destination URL appears to be broken or unreachable. Proceed with caution.
                </div>
              )}

              {/* Visit button */}
              <button
                className={`${styles.visitBtn} ${!status?.isAlive ? styles.visitBtnDanger : ''}`}
                onClick={handleVisit}
              >
                {status?.isAlive ? 'Visit Link' : 'Visit Anyway'}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </button>

              <Link to="/" className={styles.backLink}>← Back to Lynq</Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
