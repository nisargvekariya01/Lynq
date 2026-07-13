import { useNavigate } from 'react-router-dom';
import styles from './Unlock.module.css';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <div className={styles.card}>
          <div className={styles.header}>
            <div className={styles.iconWrapper} style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
            </div>
            <h1>404</h1>
            <p>Oops! The page or link you're looking for doesn't exist, has been deleted, or has expired.</p>
          </div>

          <button className={styles.submitBtn} onClick={() => navigate('/')}>
            Back to Home
          </button>
        </div>
      </main>
    </div>
  );
}
