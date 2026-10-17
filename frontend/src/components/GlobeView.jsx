import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import Globe from 'react-globe.gl';
import styles from './GlobeView.module.css';
import { COUNTRY_CENTROIDS } from '../utils/geoCoordinates.js';
import { getCountryFlag, getCountryName } from '../utils/telemetry.js';

/**
 * GlobeView Component - Hexed Polygons Globe Implementation
 * 
 * Powered by official globe.gl (via react-globe.gl)
 * - Natural Earth 110m countries GeoJSON
 * - Hexed polygons with resolution=3, margin=0.3, useDots=true
 * - Dark Earth surface texture + deep space night sky background
 * - Official random color palette (with optional visit density mode toggle)
 * - Hover tooltip with Country Name (ADMIN), ISO_A2, Population (POP_EST)
 * - Drag to rotate, pinch/scroll to zoom, auto-rotation control
 */
export default function GlobeView({ 
  geoPoints = [], 
  countries = [], 
  regions = [], 
  shortCode = '' 
}) {
  const containerRef = useRef(null);
  const globeEl = useRef(null);
  const [countriesData, setCountriesData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dimensions, setDimensions] = useState({
    width: typeof window !== 'undefined' ? Math.min(window.innerWidth - 350, 840) : 800,
    height: 520,
  });
  const [autoRotate, setAutoRotate] = useState(true);
  const [colorMode, setColorMode] = useState('random'); // 'random' (official) | 'telemetry'
  const [hoveredCountry, setHoveredCountry] = useState(null);

  // 1. Load Natural Earth 110m countries GeoJSON
  useEffect(() => {
    let isMounted = true;
    const localGeoJson = '/datasets/ne_110m_admin_0_countries.geojson';
    const cdnGeoJson = 'https://cdn.jsdelivr.net/gh/vasturiano/globe.gl/example/datasets/ne_110m_admin_0_countries.geojson';

    fetch(localGeoJson)
      .then((res) => {
        if (!res.ok) throw new Error('Local dataset unavailable, using CDN fallback');
        return res.json();
      })
      .catch(() => fetch(cdnGeoJson).then((res) => res.json()))
      .then((data) => {
        if (isMounted && data?.features) {
          setCountriesData(data.features);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load country GeoJSON dataset:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Responsive container size measurement
  useEffect(() => {
    if (!containerRef.current) return;

    const updateDimensions = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        if (clientWidth > 0 && clientHeight > 0) {
          setDimensions({
            width: clientWidth,
            height: clientHeight,
          });
        }
      }
    };

    updateDimensions();
    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(containerRef.current);

    return () => resizeObserver.disconnect();
  }, []);

  // 3. OrbitControls settings (auto-rotation speed, drag, zoom)
  useEffect(() => {
    if (globeEl.current) {
      const controls = globeEl.current.controls();
      if (controls) {
        controls.autoRotate = autoRotate;
        controls.autoRotateSpeed = 0.6;
        controls.enableZoom = true;
      }
    }
  }, [autoRotate]);

  // Initial camera orientation centered on equator
  useEffect(() => {
    if (globeEl.current) {
      globeEl.current.pointOfView({ lat: 5, lng: 10, altitude: 2.15 });
    }
  }, [loading]);

  // 4. Stable random colors map per country (official globe.gl formula)
  // Formula: `#${Math.round(Math.random() * Math.pow(2, 24)).toString(16).padStart(6, '0')}`
  const randomColorMap = useMemo(() => {
    const map = new Map();
    countriesData.forEach((feat, idx) => {
      const p = feat.properties || {};
      const key = p.ISO_A2 || p.ADMIN || idx;
      const hex = `#${Math.round(Math.random() * Math.pow(2, 24)).toString(16).padStart(6, '0')}`;
      map.set(key, hex);
    });
    return map;
  }, [countriesData]);

  // Telemetry visits map for data-driven color mode
  const visitsMeta = useMemo(() => {
    const map = {};
    let max = 1;
    (countries || []).forEach((c) => {
      const code = String(c.country || '').toUpperCase();
      map[code] = c.count;
      if (c.count > max) max = c.count;
    });
    return { map, max };
  }, [countries]);

  // 5. Hex Polygon Color function
  const getHexPolygonColor = useCallback(
    (feat) => {
      const p = feat.properties || {};
      const key = p.ISO_A2 || p.ADMIN;

      if (colorMode === 'random') {
        return randomColorMap.get(key) || '#38bdf8';
      }

      // Telemetry / Data-driven mode
      const count = visitsMeta.map[String(p.ISO_A2).toUpperCase()] || 0;
      if (count === 0) return 'rgba(30, 41, 59, 0.45)'; // Subtle slate base
      const ratio = count / visitsMeta.max;
      if (ratio > 0.75) return '#f43f5e'; // Ultra High (Rose Red)
      if (ratio > 0.45) return '#fb923c'; // High (Amber Orange)
      if (ratio > 0.20) return '#38bdf8'; // Moderate (Cyan)
      return '#818cf8';                  // Standard (Indigo)
    },
    [colorMode, randomColorMap, visitsMeta]
  );

  // 6. Hex Polygon Hover Label (ADMIN, ISO_A2, POP_EST)
  const getHexPolygonLabel = useCallback(
    ({ properties: d }) => {
      const popEst = d.POP_EST ? Number(d.POP_EST).toLocaleString() : 'N/A';
      const visitCount = visitsMeta.map[String(d.ISO_A2).toUpperCase()] || 0;
      const flag = getCountryFlag(d.ISO_A2);

      return `
        <div style="
          background: rgba(15, 23, 42, 0.94);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          padding: 10px 14px;
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.16);
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.5), 0 0 12px rgba(56, 189, 248, 0.2);
          color: #f8fafc;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 13px;
          line-height: 1.45;
          min-width: 175px;
          pointer-events: none;
        ">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
            <span style="font-size: 16px;">${flag || '🌐'}</span>
            <b style="font-size: 14px; color: #38bdf8;">${d.ADMIN} (${d.ISO_A2})</b>
          </div>
          <div style="color: #cbd5e1; font-size: 12px; margin-bottom: ${visitCount > 0 ? '4px' : '0'};">
            Population: <i style="color: #f1f5f9; font-style: normal; font-weight: 600;">${popEst}</i>
          </div>
          ${visitCount > 0 ? `
            <div style="padding-top: 5px; border-top: 1px solid rgba(255, 255, 255, 0.1); display: flex; justify-content: space-between; align-items: center; font-size: 12px;">
              <span style="color: #94a3b8;">Link Visits:</span>
              <span style="color: #4ade80; font-weight: 700;">${visitCount} clicks</span>
            </div>
          ` : ''}
        </div>
      `;
    },
    [visitsMeta]
  );

  // Focus globe camera to country centroid
  const focusCountry = useCallback((isoCode) => {
    const coord = COUNTRY_CENTROIDS[isoCode.toUpperCase()];
    if (coord && globeEl.current) {
      globeEl.current.pointOfView({ lat: coord.lat, lng: coord.lng, altitude: 1.8 }, 1200);
    }
  }, []);

  // Reset view to default
  const resetView = useCallback(() => {
    if (globeEl.current) {
      globeEl.current.pointOfView({ lat: 5, lng: 10, altitude: 2.15 }, 1000);
    }
  }, []);

  // Top visited countries for quick-focus chips
  const topActiveCountries = useMemo(() => {
    return (countries || []).slice(0, 5);
  }, [countries]);

  return (
    <div className={styles.globeContainer} ref={containerRef}>
      {/* ── Top Bar Overlay Controls ────────────────────────────────────────── */}
      <div className={styles.topOverlay}>
        <div className={styles.titleArea}>
          <span className={styles.globeIcon}>🌐</span>
          <div>
            <div className={styles.titleText}>Hexed Polygons Globe</div>
            <div className={styles.titleSub}>
              {loading ? 'Loading GeoJSON...' : `${countriesData.length} Countries · Res 3 · Margin 0.3`}
            </div>
          </div>
        </div>

        <div className={styles.toolbar}>
          {/* Mode Switcher: Random Colors vs Visit Density */}
          <button
            type="button"
            className={`${styles.toolBtn} ${colorMode === 'random' ? styles.toolBtnActive : ''}`}
            onClick={() => setColorMode(colorMode === 'random' ? 'telemetry' : 'random')}
            title="Toggle between official random colors and link visit density"
          >
            <span>🎨</span>
            <span>{colorMode === 'random' ? 'Random Colors' : 'Visit Density'}</span>
          </button>

          {/* Auto-Rotation Toggle */}
          <button
            type="button"
            className={`${styles.toolBtn} ${autoRotate ? styles.toolBtnActive : ''}`}
            onClick={() => setAutoRotate(!autoRotate)}
            title={autoRotate ? 'Pause Auto-Rotation' : 'Resume Auto-Rotation'}
          >
            <span>{autoRotate ? '⏸️' : '▶️'}</span>
            <span>{autoRotate ? 'Spinning' : 'Paused'}</span>
          </button>

          {/* Reset Camera View */}
          <button
            type="button"
            className={styles.toolBtn}
            onClick={resetView}
            title="Reset globe orientation"
          >
            <span>🎯</span>
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* ── Interaction Hint ──────────────────────────────────────────────── */}
      <div className={styles.hintPill}>
        <span>🖱️ Drag to rotate · Scroll to zoom · Hover country for info</span>
      </div>

      {/* ── Globe.gl Canvas Wrapper ────────────────────────────────────────── */}
      <div className={styles.canvasWrapper}>
        {dimensions.width > 0 && (
          <Globe
            ref={globeEl}
            width={dimensions.width}
            height={dimensions.height}
            // 5. Dark earth texture + night sky background
            globeImageUrl="//cdn.jsdelivr.net/npm/three-globe/example/img/earth-dark.jpg"
            backgroundImageUrl="//cdn.jsdelivr.net/npm/three-globe/example/img/night-sky.png"
            // 2 & 3. Hexed polygons settings
            hexPolygonsData={countriesData}
            hexPolygonResolution={3}
            hexPolygonMargin={0.3}
            hexPolygonUseDots={true}
            hexPolygonColor={getHexPolygonColor}
            // 4. Tooltip on hover with ADMIN, ISO_A2, POP_EST
            hexPolygonLabel={getHexPolygonLabel}
            onHexPolygonHover={(polygon) => setHoveredCountry(polygon || null)}
            animateIn={true}
          />
        )}
      </div>

      {/* ── Bottom Overlay: Legend & Quick Focus Chips ─────────────────────── */}
      <div className={styles.bottomOverlay}>
        {/* Dynamic Legend */}
        <div className={styles.legendBar}>
          <span className={styles.legendLabel}>
            {colorMode === 'random' ? 'Hex Palette:' : 'Density Tier:'}
          </span>
          {colorMode === 'random' ? (
            <div className={styles.legendItem}>
              <span className={styles.sampleBadge}>Official 24-bit Hex Colors</span>
            </div>
          ) : (
            <>
              <div className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: '#f43f5e', color: '#f43f5e' }} />
                <span>Peak</span>
              </div>
              <div className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: '#fb923c', color: '#fb923c' }} />
                <span>High</span>
              </div>
              <div className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: '#38bdf8', color: '#38bdf8' }} />
                <span>Moderate</span>
              </div>
              <div className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: '#818cf8', color: '#818cf8' }} />
                <span>Standard</span>
              </div>
            </>
          )}
        </div>

        {/* Quick Country Focus Chips */}
        {topActiveCountries.length > 0 && (
          <div className={styles.focusList}>
            {topActiveCountries.map((c) => {
              const flag = getCountryFlag(c.country);
              const name = getCountryName(c.country);
              return (
                <button
                  key={c.country}
                  type="button"
                  className={styles.focusChip}
                  onClick={() => focusCountry(c.country)}
                  title={`Focus on ${name}`}
                >
                  <span>{flag}</span>
                  <span>{name}</span>
                  <span className={styles.focusCount}>{c.count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
