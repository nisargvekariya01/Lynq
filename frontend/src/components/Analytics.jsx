import { useState, useMemo, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import styles from './Analytics.module.css';
import { getLiveStreamUrl, downloadAnalyticsCsv } from '../services/api';
import {
  getCountryFlag,
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
  const [activeTab, setActiveTab] = useState('timeline'); // 'timeline' | 'geo' | 'tech' | 'sources'
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
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'click') {
            setLiveClick(payload);
            setLiveClickBump((prev) => prev + 1);
          }
        } catch (e) {
          // ignore non-json messages (e.g. heartbeat)
        }
      };

      eventSource.onerror = () => {
        setLiveConnected(false);
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
              from <strong>{getCountryFlag(liveClick.country)} {liveClick.city && liveClick.city !== 'Unknown' ? `${liveClick.city}, ` : ''}{getCountryName(liveClick.country)}</strong>
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
          icon={topCountry ? getCountryFlag(topCountry.country) : '🌍'}
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

      {/* ── Tab Navigation ───────────────────────────────────── */}
      <div className={styles.tabsContainer}>
        <button
          className={`${styles.tabButton} ${activeTab === 'timeline' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('timeline')}
        >
          <span>📈</span> Timeline
        </button>
        <button
          className={`${styles.tabButton} ${activeTab === 'geo' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('geo')}
        >
          <span>🌍</span> Geography {data.countries?.length > 0 && `(${data.countries.length})`}
        </button>
        <button
          className={`${styles.tabButton} ${activeTab === 'tech' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('tech')}
        >
          <span>📱</span> Devices & Tech
        </button>
        <button
          className={`${styles.tabButton} ${activeTab === 'sources' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('sources')}
        >
          <span>🔗</span> Traffic Sources {data.referrers?.length > 0 && `(${data.referrers.length})`}
        </button>
      </div>

      {/* ── TAB 1: Click Timeline ────────────────────────────── */}
      {activeTab === 'timeline' && (
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
        </div>
      )}

      {/* ── TAB 2: Geography & Country Breakdown ─────────────── */}
      {activeTab === 'geo' && (
        <div className={styles.viewSection}>
          <div className={styles.geoGrid}>
            {/* Top Countries */}
            <div className={styles.cardPanel}>
              <div className={styles.cardTitle}>Top Countries</div>
              {data.countries && data.countries.length > 0 ? (
                <div className={styles.countryList}>
                  {data.countries.map((c) => {
                    const percentage = Math.round((c.count / (totalClicksCount || 1)) * 100);
                    return (
                      <div key={c.country} className={styles.geoRow}>
                        <div className={styles.geoMeta}>
                          <span className={styles.geoName}>
                            <span className={styles.flag}>{getCountryFlag(c.country)}</span>
                            {getCountryName(c.country)}
                          </span>
                          <span className={styles.geoCount}>
                            <span className={styles.geoCountStrong}>{c.count}</span>
                            <span>({percentage}%)</span>
                          </span>
                        </div>
                        <div className={styles.progressBarTrack}>
                          <div 
                            className={styles.progressBarFill} 
                            style={{ width: `${Math.max(percentage, 5)}%` }} 
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className={styles.emptyNotice}>No country data recorded yet.</div>
              )}
            </div>

            {/* Top Cities */}
            <div className={styles.cardPanel}>
              <div className={styles.cardTitle}>Top Cities</div>
              {data.cities && data.cities.length > 0 ? (
                <div className={styles.cityList}>
                  {data.cities.map((cityItem, i) => (
                    <div key={`${cityItem.city}-${i}`} className={styles.geoRow}>
                      <div className={styles.geoMeta}>
                        <span className={styles.geoName}>
                          <span className={styles.flag}>{getCountryFlag(cityItem.country)}</span>
                          {cityItem.city || 'Unknown City'}
                        </span>
                        <span className={styles.geoCount}>
                          <span className={styles.geoCountStrong}>{cityItem.count} clicks</span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.emptyNotice}>No city data recorded yet.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: Devices & Tech Charts ─────────────────────── */}
      {activeTab === 'tech' && (
        <div className={styles.viewSection}>
          <div className={styles.techGrid}>
            {/* Device Donut Chart */}
            <div className={styles.cardPanel}>
              <div className={styles.cardTitle}>Device Distribution</div>
              {deviceData.length > 0 ? (
                <div className={styles.donutWrapper}>
                  <ResponsiveContainer width="100%" height={170}>
                    <PieChart>
                      <Pie
                        data={deviceData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={68}
                        paddingAngle={4}
                        animationDuration={400}
                      >
                        {deviceData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(15, 23, 42, 0.95)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className={styles.donutLegend}>
                    {deviceData.map((d) => (
                      <div key={d.name} className={styles.legendItem}>
                        <span className={styles.legendDot} style={{ background: d.color }} />
                        <span>{d.icon} {d.name} ({Math.round((d.value / totalDevicesCount) * 100)}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className={styles.emptyNotice}>No device data yet.</div>
              )}
            </div>

            {/* Browsers & OS Breakdown */}
            <div className={styles.cardPanel}>
              <div className={styles.cardTitle}>Browsers & Operating Systems</div>
              <div className={styles.breakdownStack}>
                {/* Browsers */}
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', fontWeight: 600 }}>
                    Browsers
                  </div>
                  {data.browsers && data.browsers.length > 0 ? (
                    data.browsers.slice(0, 4).map((b, idx) => {
                      const share = Math.round((b.count / (totalClicksCount || 1)) * 100);
                      return (
                        <div key={b.browser} className={styles.pillRow}>
                          <div className={styles.pillMeta}>
                            <span>{b.browser}</span>
                            <span><strong>{b.count}</strong> ({share}%)</span>
                          </div>
                          <div className={styles.progressBarTrack}>
                            <div
                              className={styles.progressBarFill}
                              style={{
                                width: `${Math.max(share, 5)}%`,
                                background: CHART_COLORS[idx % CHART_COLORS.length]
                              }}
                            />
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className={styles.emptyNotice}>No browser data yet.</div>
                  )}
                </div>

                {/* Operating Systems */}
                <div style={{ marginTop: '10px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', fontWeight: 600 }}>
                    Operating Systems
                  </div>
                  {data.os && data.os.length > 0 ? (
                    data.os.slice(0, 3).map((o, idx) => {
                      const share = Math.round((o.count / (totalClicksCount || 1)) * 100);
                      return (
                        <div key={o.os} className={styles.pillRow}>
                          <div className={styles.pillMeta}>
                            <span>{o.os}</span>
                            <span><strong>{o.count}</strong> ({share}%)</span>
                          </div>
                          <div className={styles.progressBarTrack}>
                            <div
                              className={styles.progressBarFill}
                              style={{
                                width: `${Math.max(share, 5)}%`,
                                background: CHART_COLORS[(idx + 2) % CHART_COLORS.length]
                              }}
                            />
                          </div>
                        </div>
                      );
                    })
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 4: Traffic Sources & Referrers ────────────────── */}
      {activeTab === 'sources' && (
        <div className={styles.viewSection}>
          <div className={styles.cardPanel}>
            <div className={styles.cardTitle}>Referrers & Acquisition Channels</div>
            {data.referrers && data.referrers.length > 0 ? (
              <div className={styles.sourcesTable}>
                {data.referrers.map((r) => {
                  const meta = getReferrerMeta(r.referrer);
                  const share = Math.round((r.count / (totalClicksCount || 1)) * 100);
                  return (
                    <div key={r.referrer} className={styles.sourceRow}>
                      <div className={styles.sourceLeft}>
                        <span className={styles.sourceIcon}>{meta.icon}</span>
                        <div>
                          <div className={styles.sourceDomain}>{meta.label}</div>
                          <span 
                            className={styles.sourceCategory} 
                            style={{ 
                              background: `${meta.badgeColor}20`, 
                              color: meta.badgeColor,
                              border: `1px solid ${meta.badgeColor}40`
                            }}
                          >
                            {meta.category}
                          </span>
                        </div>
                      </div>
                      <div className={styles.sourceRight}>
                        <span className={styles.sourceShare}>{share}%</span>
                        <span className={styles.sourceClicks}>{r.count} clicks</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={styles.emptyNotice}>No referrer data recorded yet.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
