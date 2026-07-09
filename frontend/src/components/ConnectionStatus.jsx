import { useState, useEffect } from 'react';
import { checkHealth } from '../services/api.js';
import styles from './ConnectionStatus.module.css';

export default function ConnectionStatus() {
  const [health, setHealth] = useState({ db: 'loading', redis: 'loading' });

  useEffect(() => {
    let mounted = true;

    const fetchHealth = async () => {
      try {
        const data = await checkHealth();
        if (mounted) {
          setHealth({ db: data.db, redis: data.redis });
        }
      } catch (err) {
        if (mounted) {
          setHealth({ db: 'error', redis: 'error' });
        }
      }
    };

    // Initial check
    fetchHealth();
    
    // Check every 30 seconds
    const interval = setInterval(fetchHealth, 30000);
    
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // Determine overall status
  const overallStatus = 
    (health.db === 'error' || health.redis === 'error') ? 'error' :
    (health.db === 'loading' || health.redis === 'loading') ? 'loading' :
    'connected';

  const statusText = 
    overallStatus === 'connected' ? 'Systems Online' :
    overallStatus === 'loading' ? 'Checking...' :
    'System Degraded';

  return (
    <div className={styles.statusContainer}>
      {/* The floating tooltip that appears on hover */}
      <div className={styles.tooltip}>
        <div className={styles.statusRow}>
          <div className={`${styles.indicator} ${styles[health.db]}`}></div>
          <span className={styles.label}>PostgreSQL: {health.db}</span>
        </div>
        <div className={styles.statusRow}>
          <div className={`${styles.indicator} ${styles[health.redis]}`}></div>
          <span className={styles.label}>Redis: {health.redis}</span>
        </div>
      </div>

      {/* The main fixed button */}
      <div className={styles.summaryRow}>
        <div className={`${styles.indicator} ${styles[overallStatus]}`}></div>
        <span className={styles.summaryLabel}>{statusText}</span>
      </div>
    </div>
  );
}
