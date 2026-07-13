import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { resolveAndTrack } from '../services/api.js';
import styles from './Unlock.module.css'; // Reuse existing sleek styles for the waiting page

/**
 * RedirectHandler
 * Catch-all route that seamlessly fetches the destination URL from the backend in the background.
 * While waiting (e.g. if the Render backend is sleeping), it shows a beautiful spinner
 * instead of the default Render HTML loading page.
 */
export default function RedirectHandler() {
  const { shortCode } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    if (!shortCode) return;

    // Background fetch to wake up server and resolve link
    resolveAndTrack(shortCode)
      .then(({ result }) => {
        if (result.requiresPassword) {
          navigate(`/unlock/${shortCode}`);
        } else {
          // Hard redirect to the actual destination
          window.location.replace(result.originalUrl);
        }
      })
      .catch((err) => {
        if (err.response?.status === 404) {
          setError('This link does not exist or has expired.');
        } else {
          setError(err.response?.data?.error || 'Failed to resolve link. The server might be down.');
        }
      });
  }, [shortCode, navigate]);

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <div className={styles.card}>
          <div className={styles.header}>
            <div className={styles.iconWrapper}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
              </svg>
            </div>
            <h1>{error ? 'Oops!' : 'Resolving Link...'}</h1>
            <p>{error || 'Waking up the server and fetching your destination. This might take a few seconds.'}</p>
          </div>

          {!error && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
              <div className="spinner" style={{ width: '40px', height: '40px' }}></div>
            </div>
          )}

          {error && (
            <button className={styles.submitBtn} onClick={() => navigate('/')}>
              Go Home
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
