import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import styles from './Analytics.module.css';
import { getLiveStreamUrl, downloadAnalyticsCsv } from '../services/api';
import CountryFlag from './CountryFlag.jsx';
import {
  getCountryName,
  getReferrerMeta,
  getDeviceMeta,
  CHART_COLORS
} from '../utils/telemetry';

function formatDate(isoString) {
  if (!isoString) return '—';
  const date = new Date(isoString);
  const today = new Date();
  if (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  ) {
    return 'Today';
  }
  return date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function StatBox({ label, value, icon, subtext }) {
  return (
    <div className={styles.statBox}>
      <span className={styles.statIcon}>{icon}</span>
      <div>
        <div className={styles.statValue}>{value}</div>
        <div className={styles.statLabel}>{label}</div>
        {subtext && <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{subtext}</div>}
      </div>
    </div>
  );
}

export default function Analytics({ data }) {
  const [timelineMode, setTimelineMode] = useState('total'); // 'total' | 'unique'
  const [liveClick, setLiveClick] = useState(null);
  const [liveConnected, setLiveConnected] = useState(false);
  const [liveClickBump, setLiveClickBump] = useState(0);

  // ── Task 3.4: Server-Sent Events (SSE) Live Click Stream ────────────────
  useEffect(() => {
    if (!data?.shortCode) return;

    let eventSource = null;
    try {
      const sseUrl = getLiveStreamUrl(data.shortCode);
      eventSource = new EventSource(sseUrl);

      eventSource.onopen = () => {
        setLiveConnected(true);
      };

      eventSource.onmessage = (event) => {
        setLiveConnected(true);
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'connected' || payload.type === 'ping') {
            setLiveConnected(true);
          } else if (payload.type === 'click') {
            setLiveClick(payload);
            setLiveClickBump((prev) => prev + 1);
          }
        } catch (e) {
          // ignore non-json messages
        }
      };

      eventSource.onerror = () => {
        if (eventSource.readyState === EventSource.CLOSED) {
          setLiveConnected(false);
        }
      };
    } catch (err) {
      console.warn('SSE connection failed:', err);
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [data?.shortCode]);

  // Clear live ticker badge after 8s
  useEffect(() => {
    if (!liveClick) return;
    const timer = setTimeout(() => {
      setLiveClick(null);
    }, 8000);
    return () => clearTimeout(timer);
  }, [liveClick]);

  // ── Timeline Data ─────────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    return (data?.history || []).map((item) => ({
      time: new Date(item.bucket).getTime(),
      total_clicks: parseInt(item.total_clicks, 10) || 0,
      unique_clicks: parseInt(item.unique_clicks, 10) || 0,
    }));
  }, [data?.history]);

  // ── Devices Donut Data ────────────────────────────────────────────────────
  const deviceData = useMemo(() => {
    const list = data?.devices || [];
    return list.map((d, idx) => {
      const meta = getDeviceMeta(d.device);
      return {
        name: meta.label,
        value: parseInt(d.count, 10) || 0,
        color: meta.color || CHART_COLORS[idx % CHART_COLORS.length],
        icon: meta.icon,
      };
    });
  }, [data?.devices]);

  // ── Total Clicks for Percentages ──────────────────────────────────────────
  const totalClicksCount = (data?.clicks || 0) + liveClickBump;
  const totalDevicesCount = useMemo(() => {
    return deviceData.reduce((acc, curr) => acc + curr.value, 0) || 1;
  }, [deviceData]);

  // ── Top Summary Items ─────────────────────────────────────────────────────
  const topCountry = data?.countries?.[0] || null;
  const topReferrer = data?.referrers?.[0] || null;

  if (!data) return null;

  const hasTimeline = chartData.length > 0;
  const timelineKey = timelineMode === 'total' ? 'total_clicks' : 'unique_clicks';
  const lineColor = timelineMode === 'total' ? '#6366f1' : '#8b5cf6';

  return (
    <div className={styles.container}>
      {/* ── Top Header ───────────────────────────────────────── */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <svg className={styles.headerIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
            <line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
          <span>Link Intelligence & Analytics</span>
        </div>

        <div className={styles.headerRight}>
          <Link
            to={`/stats/${data.shortCode}`}
            className={styles.fullStatsBtn}
            title="Open dedicated analytics page with 3D spherical globe"
          >
            <span>🌐 Full Analytics</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </Link>

          <button
            type="button"
            className={styles.exportCsvBtn}
            onClick={() => downloadAnalyticsCsv(data.shortCode)}
            title="Export full historical click telemetry to CSV"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Export CSV</span>
          </button>

          {/* Live SSE Status Pill */}
          <div className={styles.liveBadge} title="Real-time SSE event stream active">
            <span className={styles.liveDot} style={{ background: liveConnected ? '#10b981' : '#eab308' }} />
            <span>{liveConnected ? 'Live Pulse' : 'Connecting...'}</span>
          </div>
        </div>
      </div>

      {/* ── Live Ticker Banner (SSE event pulse) ──────────────── */}
      {liveClick && (
        <div className={styles.liveTicker}>
          <div className={styles.tickerContent}>
            <span className={styles.tickerTag}>⚡ Live Click</span>
            <span>
              from <strong><CountryFlag countryCode={liveClick.country} size="sm" /> {liveClick.city && liveClick.city !== 'Unknown' ? `${liveClick.city}, ` : ''}{getCountryName(liveClick.country)}</strong>
              {' '}via <strong>{liveClick.browser}</strong> on {liveClick.device}
            </span>
          </div>
          <span className={styles.tickerTime}>just now</span>
        </div>
      )}

      {/* ── Key Metrics Stats Grid ───────────────────────────── */}
      <div className={styles.stats}>
        <StatBox
          icon="🖱️"
          label="Total Clicks"
          value={totalClicksCount.toLocaleString()}
          subtext={liveClickBump > 0 ? `+${liveClickBump} live` : null}
        />
        <StatBox
          icon="👥"
          label="Unique Visitors"
          value={(data.uniqueVisitors ?? 0).toLocaleString()}
        />
        <StatBox
          icon={topCountry ? <CountryFlag countryCode={topCountry.country} size="lg" /> : '🌍'}
          label="Top Country"
          value={topCountry ? getCountryName(topCountry.country) : '—'}
          subtext={topCountry ? `${topCountry.count} clicks` : null}
        />
        <StatBox
          icon={topReferrer ? getReferrerMeta(topReferrer.referrer).icon : '🔗'}
          label="Top Channel"
          value={topReferrer ? getReferrerMeta(topReferrer.referrer).label : '—'}
          subtext={topReferrer ? `${topReferrer.count} clicks` : null}
        />
      </div>

      {/* ── Click Timeline ────────────────────────────── */}
      <div className={styles.viewSection}>
          {hasTimeline ? (
            <div>
              <div className={styles.chartHeader}>
                <div className={styles.chartTitle}>Click Distribution Over Time</div>
                <div className={styles.toggleContainer}>
                  <div className={`${styles.toggleSlider} ${timelineMode === 'unique' ? styles.sliderRight : ''}`} />
                  <button 
                    className={`${styles.toggleButton} ${timelineMode === 'total' ? styles.activeText : ''}`}
                    onClick={() => setTimelineMode('total')}
                  >
                    Total
                  </button>
                  <button 
                    className={`${styles.toggleButton} ${timelineMode === 'unique' ? styles.activeText : ''}`}
                    onClick={() => setTimelineMode('unique')}
                  >
                    Unique
                  </button>
                </div>
              </div>
              <div className={styles.chartWrapper}>
                <ResponsiveContainer width="100%" height={230}>
                  <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                    <XAxis 
                      dataKey="time" 
                      tickFormatter={(time) => {
                        const d = new Date(time);
                        return data.bucketInterval === 'hour' 
                          ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
                      }}
                      stroke="rgba(255,255,255,0.35)"
                      fontSize={11}
                      tickMargin={10}
                    />
                    <YAxis 
                      allowDecimals={false} 
                      stroke="rgba(255,255,255,0.35)" 
                      fontSize={11}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(15, 23, 42, 0.95)', 
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: '10px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                        fontSize: '12px'
                      }}
                      itemStyle={{ color: lineColor, fontWeight: 'bold' }}
                      labelFormatter={(time) => new Date(time).toLocaleString([], {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    />
                    <Line 
                      type="monotone" 
                      dataKey={timelineKey} 
                      name={timelineMode === 'total' ? 'Total Clicks' : 'Unique Clicks'}
                      stroke={lineColor} 
                      strokeWidth={3}
                      dot={{ r: 4, fill: lineColor, strokeWidth: 2, stroke: '#0f172a' }}
                      activeDot={{ r: 6, fill: '#fff' }}
                      animationDuration={400}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className={styles.emptyNotice}>
              No timeline history yet. Click the link to generate data!
            </div>
          )}

          {/* Quick link to 3D Globe & full deep breakdown */}
          <div style={{
            marginTop: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            padding: '14px 18px',
            borderRadius: '12px',
            background: 'rgba(99, 102, 241, 0.08)',
            border: '1px solid rgba(99, 102, 241, 0.22)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary, #cbd5e1)' }}>
              <span style={{ fontSize: '16px' }}>🌐</span>
              <span>View <strong>3D Spherical Globe</strong>, state/country density, hardware & traffic analytics</span>
            </div>
            <Link
              to={`/stats/${data.shortCode}`}
              className={styles.fullStatsBtn}
              style={{ padding: '7px 16px', fontSize: '13px', fontWeight: 600 }}
            >
              <span>Open Full Analytics →</span>
            </Link>
          </div>
        </div>
    </div>
  );
}
