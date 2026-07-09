import { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import styles from './Analytics.module.css';

/**
 * Format ISO date string to a readable date.
 */
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

function StatBox({ label, value, icon }) {
  return (
    <div className={styles.statBox}>
      <span className={styles.statIcon}>{icon}</span>
      <div>
        <div className={styles.statValue}>{value}</div>
        <div className={styles.statLabel}>{label}</div>
      </div>
    </div>
  );
}

export default function Analytics({ data }) {
  const [viewMode, setViewMode] = useState('total'); // 'total' | 'unique'

  const chartData = useMemo(() => {
    return (data?.history || []).map(item => ({
      time: new Date(item.bucket).getTime(),
      total_clicks: parseInt(item.total_clicks, 10) || 0,
      unique_clicks: parseInt(item.unique_clicks, 10) || 0,
    }));
  }, [data?.history]);

  if (!data) return null;

  const hasData = chartData.length > 0;
  const dataKey = viewMode === 'total' ? 'total_clicks' : 'unique_clicks';
  const lineColor = viewMode === 'total' ? '#6366f1' : '#8b5cf6'; // Indigo vs Violet

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
            <line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
          <span>Analytics</span>
        </div>
      </div>

      <div className={styles.stats}>
        <StatBox
          icon="🖱️"
          label="Total Clicks"
          value={data.clicks?.toLocaleString() ?? '0'}
        />
        <StatBox
          icon="👥"
          label="Unique Visitors"
          value={data.uniqueVisitors?.toLocaleString() ?? '0'}
        />
        <StatBox
          icon="📅"
          label="Created"
          value={formatDate(data.createdAt)}
        />
      </div>

      {hasData && (
        <div className={styles.chartSection}>
          <div className={styles.chartHeader}>
            <div className={styles.chartTitle}>Click Timeline</div>
            <div className={styles.toggleContainer}>
              <div className={`${styles.toggleSlider} ${viewMode === 'unique' ? styles.sliderRight : ''}`} />
              <button 
                className={`${styles.toggleButton} ${viewMode === 'total' ? styles.activeText : ''}`}
                onClick={() => setViewMode('total')}
              >
                Total
              </button>
              <button 
                className={`${styles.toggleButton} ${viewMode === 'unique' ? styles.activeText : ''}`}
                onClick={() => setViewMode('unique')}
              >
                Unique
              </button>
            </div>
          </div>
          <div className={styles.chartWrapper}>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                <XAxis 
                  dataKey="time" 
                  tickFormatter={(time) => {
                    const d = new Date(time);
                    return data.bucketInterval === 'hour' 
                      ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
                  }}
                  stroke="rgba(255,255,255,0.4)"
                  fontSize={11}
                  tickMargin={10}
                />
                <YAxis 
                  allowDecimals={false} 
                  stroke="rgba(255,255,255,0.4)" 
                  fontSize={11}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(15, 23, 42, 0.9)', 
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.5)',
                    fontSize: '12px'
                  }}
                  itemStyle={{ color: lineColor, fontWeight: 'bold' }}
                  labelFormatter={(time) => new Date(time).toLocaleString([], {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                  })}
                />
                <Line 
                  type="monotone" 
                  dataKey={dataKey} 
                  name={viewMode === 'total' ? 'Total Clicks' : 'Unique Clicks'}
                  stroke={lineColor} 
                  strokeWidth={3}
                  dot={{ r: 4, fill: lineColor, strokeWidth: 2, stroke: '#1e293b' }}
                  activeDot={{ r: 6, fill: '#fff' }}
                  animationDuration={500}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
