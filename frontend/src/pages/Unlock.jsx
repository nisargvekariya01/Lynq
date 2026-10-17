import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { verifyPassword } from '../services/api.js';
import AppHeader from '../components/AppHeader.jsx';
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
      <AppHeader theme={theme} onToggleTheme={onToggleTheme} />

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
