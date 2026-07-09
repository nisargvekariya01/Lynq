import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { verifyPassword } from '../services/api.js';
import ThemeToggle from '../components/ThemeToggle.jsx';
import homeStyles from './Home.module.css';
import styles from './Unlock.module.css';

export default function Unlock({ theme, onToggleTheme, addToast }) {
  const { shortCode } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password) return;

    setIsVerifying(true);
    try {
      const data = await verifyPassword(shortCode, password);
      addToast('Password accepted! Redirecting...', 'success', 2000);
      window.location.href = data.originalUrl;
    } catch (err) {
      const msg = err?.response?.data?.error || 'Incorrect password.';
      addToast(msg, 'error');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* ── Header ─────────────────────────────────── */}
      <header className={homeStyles.header}>
        <div className={homeStyles.headerInner}>
          <div 
            className={homeStyles.logo} 
            style={{ cursor: 'pointer' }} 
            onClick={() => navigate('/')}
          >
            <div className={homeStyles.logoMark}>
              <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
                <rect width="32" height="32" rx="8" fill="url(#logoGrad)"/>
                <text x="16" y="22" fontFamily="Inter,sans-serif" fontSize="16" fontWeight="900"
                      textAnchor="middle" fill="white">L</text>
                <defs>
                  <linearGradient id="logoGrad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
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

      {/* ── Main Content ───────────────────────────── */}
      <main className={styles.main}>
        <form className={styles.card} onSubmit={handleSubmit}>
          <div className={styles.icon}>🔒</div>
          <div>
            <h1 className={styles.title}>Protected Link</h1>
            <p className={styles.subtitle}>
              This link is password protected. Enter the password below to access the destination.
            </p>
          </div>

          <div className={styles.inputGroup}>
            <input
              type="password"
              placeholder="Enter password..."
              className={styles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              required
            />
            <button type="submit" className={styles.button} disabled={isVerifying || !password}>
              {isVerifying ? 'Verifying...' : 'Unlock Link'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
