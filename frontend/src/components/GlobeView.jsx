import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import Globe from 'react-globe.gl';
import styles from './GlobeView.module.css';
import { COUNTRY_CENTROIDS } from '../utils/geoCoordinates.js';
import { getCountryName } from '../utils/telemetry.js';
import CountryFlag, { getCountryFlagImgHtml } from './CountryFlag.jsx';

/**
 * 7 alternating slate-grey tones mapped via Natural Earth's MAPCOLOR7 (values 1..7).
 * Natural Earth precomputes MAPCOLOR7 so that adjacent countries NEVER share the same value.
 * This guarantees that borders and shapes between all non-visited countries are clearly discernible.
 */
const INACTIVE_GREY_PALETTE = [
  '#475569', // Slate-600
  '#64748b', // Slate-500 (lighter)
  '#334155', // Slate-700 (darker)
  '#526075', // Slate-550
  '#3f4b5d', // Slate-650
  '#5c6b82', // Slate-520 (soft blue-slate)
  '#384454', // Slate-680
];

/**
 * GlobeView Component - Hexed Polygons Globe Implementation
 * 
 * Powered by official globe.gl (via react-globe.gl)
 * - Natural Earth 110m countries GeoJSON
 * - Auto-orients to highest visit density country on initial load
 * - Default state is stationary (paused)
 * - Always in visit density mode with Lynq theme colors
 * - Unvisited countries rendered with distinct slate-grey borders
 * - Interaction hints placed in upper-right corner
 */
export default function GlobeView({ 
  geoPoints = [], 
  countries = [], 
  regions = [], 
  shortCode = '' 
}) {
  const containerRef = useRef(null);
  const globeEl = useRef(null);
  const hasOrientedRef = useRef(false);

  const [countriesData, setCountriesData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dimensions, setDimensions] = useState({
    width: typeof window !== 'undefined' ? Math.min(window.innerWidth - 350, 840) : 800,
    height: 540,
  });
  // Always paused by default
  const [autoRotate, setAutoRotate] = useState(false);
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

  // 3. OrbitControls settings (always paused by default)
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

  // 4. Automatically orient camera to highest visit density country upon opening
  useEffect(() => {
    if (!globeEl.current || loading || countriesData.length === 0) return;

    if (!hasOrientedRef.current) {
      // countries is sorted by visits count descending: countries[0] is top density
      const topCountry = countries?.[0]?.country;
      const coord = topCountry ? COUNTRY_CENTROIDS[String(topCountry).toUpperCase()] : null;

      if (coord) {
        hasOrientedRef.current = true;
        // Fly smoothly to high-density country
        globeEl.current.pointOfView({ lat: coord.lat, lng: coord.lng, altitude: 2.15 }, 1200);
      } else if (countries && countries.length === 0) {
        hasOrientedRef.current = true;
        globeEl.current.pointOfView({ lat: 15, lng: 10, altitude: 2.15 }, 1000);
      }
    }
  }, [loading, countries, countriesData]);

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

  // 5. Hex Polygon Color function: Always Visible Density Mode
  const getHexPolygonColor = useCallback(
    (feat) => {
      const p = feat.properties || {};
      const isHovered = hoveredCountry?.properties?.ISO_A2 === p.ISO_A2;

      const count = visitsMeta.map[String(p.ISO_A2).toUpperCase()] || 0;

      // Non-visited / other countries:
      if (count === 0) {
        if (isHovered) return '#cbd5e1'; // Bright slate highlight on hover
        // Pick distinct alternating grey shade based on MAPCOLOR7 so borders are clear
        const mapIdx = typeof p.MAPCOLOR7 === 'number' && p.MAPCOLOR7 >= 1 && p.MAPCOLOR7 <= 7
          ? p.MAPCOLOR7 - 1
          : (Math.abs((p.ADMIN || '').charCodeAt(0) || 0) % INACTIVE_GREY_PALETTE.length);
        return INACTIVE_GREY_PALETTE[mapIdx];
      }

      // Countries with visits - Lynq Theme Gradient Palette:
      if (isHovered) return '#ffffff';

      const ratio = count / visitsMeta.max;
      if (ratio > 0.75) return '#ec4899'; // Peak: Lynq Vivid Fuchsia / Magenta
      if (ratio > 0.45) return '#8b5cf6'; // High: Lynq Electric Violet / Purple
      if (ratio > 0.20) return '#6366f1'; // Medium: Lynq Primary Indigo
      return '#06b6d4';                  // Low / Standard: Lynq Cyber Cyan
    },
    [visitsMeta, hoveredCountry]
  );

  // 6. Hex Polygon Hover Label (ADMIN, ISO_A2, POP_EST)
  const getHexPolygonLabel = useCallback(
    ({ properties: d }) => {
      const popEst = d.POP_EST ? Number(d.POP_EST).toLocaleString() : 'N/A';
      const visitCount = visitsMeta.map[String(d.ISO_A2).toUpperCase()] || 0;
      const flagHtml = getCountryFlagImgHtml(d.ISO_A2);

      return `
        <div style="
          background: rgba(15, 23, 42, 0.95);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          padding: 10px 14px;
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.16);
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.6), 0 0 14px rgba(99, 102, 241, 0.25);
          color: #f8fafc;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 13px;
          line-height: 1.45;
          min-width: 175px;
          pointer-events: none;
        ">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
            ${flagHtml}
            <b style="font-size: 14px; color: #818cf8;">${d.ADMIN} (${d.ISO_A2})</b>
          </div>
          <div style="color: #cbd5e1; font-size: 12px; margin-bottom: ${visitCount > 0 ? '4px' : '0'};">
            Population: <i style="color: #f1f5f9; font-style: normal; font-weight: 600;">${popEst}</i>
          </div>
          ${visitCount > 0 ? `
            <div style="padding-top: 5px; border-top: 1px solid rgba(255, 255, 255, 0.1); display: flex; justify-content: space-between; align-items: center; font-size: 12px;">
              <span style="color: #94a3b8;">Link Visits:</span>
              <span style="color: #ec4899; font-weight: 800;">${visitCount} clicks</span>
            </div>
          ` : `
            <div style="padding-top: 4px; border-top: 1px solid rgba(255, 255, 255, 0.08); font-size: 11px; color: #64748b;">
              No visits recorded yet
            </div>
          `}
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

  // Top visited countries for quick-focus chips
  const topActiveCountries = useMemo(() => {
    return (countries || []).slice(0, 5);
  }, [countries]);

  return (
    <div className={styles.globeContainer} ref={containerRef}>
      {/* ── Top Bar Controls: Upper Right Corner (Hint Only) ── */}
      <div className={styles.topOverlay}>
        <div className={styles.toolbar}>
          {/* Interaction hint pill moved to upper-right corner */}
          <div className={styles.hintPillCorner}>
            <span>🖱️ Drag to rotate · Scroll to zoom · Hover country</span>
          </div>
        </div>
      </div>

      {/* ── Globe.gl Canvas Wrapper ────────────────────────────────────────── */}
      <div className={styles.canvasWrapper}>
        {dimensions.width > 0 && (
          <Globe
            ref={globeEl}
            width={dimensions.width}
            height={dimensions.height}
            // Dark earth texture + night sky background
            globeImageUrl="//cdn.jsdelivr.net/npm/three-globe/example/img/earth-dark.jpg"
            backgroundImageUrl="//cdn.jsdelivr.net/npm/three-globe/example/img/night-sky.png"
            // Hexed polygons settings
            hexPolygonsData={countriesData}
            hexPolygonResolution={3}
            hexPolygonMargin={0.3}
            hexPolygonUseDots={true}
            hexPolygonColor={getHexPolygonColor}
            // Tooltip on hover with ADMIN, ISO_A2, POP_EST
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
          <span className={styles.legendLabel}>Density Tier:</span>
          <div className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: '#ec4899', color: '#ec4899' }} />
            <span>Peak</span>
          </div>
          <div className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: '#8b5cf6', color: '#8b5cf6' }} />
            <span>High</span>
          </div>
          <div className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: '#6366f1', color: '#6366f1' }} />
            <span>Medium</span>
          </div>
          <div className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: '#06b6d4', color: '#06b6d4' }} />
            <span>Low</span>
          </div>
          <div className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: '#526075', color: '#526075' }} />
            <span>Other Countries</span>
          </div>
        </div>

        {/* Quick Country Focus Chips */}
        {topActiveCountries.length > 0 && (
          <div className={styles.focusList}>
            {topActiveCountries.map((c) => {
              const name = getCountryName(c.country);
              return (
                <button
                  key={c.country}
                  type="button"
                  className={styles.focusChip}
                  onClick={() => focusCountry(c.country)}
                  title={`Focus on ${name}`}
                >
                  <CountryFlag countryCode={c.country} size="sm" />
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
