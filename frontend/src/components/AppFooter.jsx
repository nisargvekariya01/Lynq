import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './AppFooter.module.css';

/**
 * Universal AppFooter Component
 * Reusable footer identical to the one on the Statistics page.
 * Features brand info, status indicator, product links, and platform references.
 */
export default function AppFooter() {
  const navigate = useNavigate();

  const handleLogoClick = () => {
    navigate('/');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className={styles.siteFooter}>
      <div className={styles.footerGrid}>
        {/* Brand Column */}
        <div className={styles.footerColBrand}>
          <div className={styles.footerLogo} onClick={handleLogoClick} title="Lynq Home">
            <div className={styles.footerLogoMark}>L</div>
            <span className={styles.footerLogoText}>Lynq</span>
          </div>
          <p className={styles.footerDesc}>
            The open-source, enterprise-grade link intelligence platform. Built with PostgreSQL, Redis Cloud, Clerk, and Google Gemini.
          </p>
          <div className={styles.footerStatus}>
            <span className={styles.statusDot} />
            <span>All Systems Operational (99.99%)</span>
          </div>
        </div>

        {/* Product Column */}
        <div className={styles.footerCol}>
          <h4>Product</h4>
          <a href="/#shorten-input-container">Link Shortener</a>
          <a href="/#recent-links-container">Deep Telemetry</a>
          <a href="/#shorten-input-container">QR Code Studio</a>
          <a href="/#shorten-input-container">AI Security Scanner</a>
          <a href="/#recent-links-container">Live Showcase</a>
        </div>

        {/* Platform Column */}
        <div className={styles.footerCol}>
          <h4>Platform</h4>
          <a href="/api/health" target="_blank" rel="noreferrer">PostgreSQL Database</a>
          <a href="/api/health" target="_blank" rel="noreferrer">Redis In-Memory</a>
          <a href="/api/health" target="_blank" rel="noreferrer">Server-Sent Events</a>
          <a href="https://clerk.com" target="_blank" rel="noreferrer">Clerk Authentication</a>
          <a href="https://ai.google.dev" target="_blank" rel="noreferrer">Google Gemini AI</a>
        </div>

        {/* Resources Column */}
        <div className={styles.footerCol}>
          <h4>Resources</h4>
          <a href="/api/health" target="_blank" rel="noreferrer">API Health Status</a>
          <a href="https://github.com" target="_blank" rel="noreferrer">GitHub Repository</a>
          <a href="/#recent-links-container">Live Pulse Stream</a>
          <a href="https://github.com" target="_blank" rel="noreferrer">Documentation</a>
        </div>
      </div>

      {/* Footer Bottom Row */}
      <div className={styles.footerBottom}>
        <div>© {new Date().getFullYear()} Lynq Technologies Inc. All rights reserved.</div>
        <div className={styles.footerLinks}>
          <span>Privacy Policy</span>
          <span>Terms of Service</span>
          <span>Cookie Preferences</span>
        </div>
      </div>
    </footer>
  );
}
