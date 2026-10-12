import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import styles from './GlobeView.module.css';
import {
  resolveCoordinates,
  getRegionLabel,
  getMarkerColorByCount,
  SAMPLE_GEO_POINTS,
  COUNTRY_CENTROIDS,
} from '../utils/geoCoordinates.js';
import { getCountryFlag, getCountryName } from '../utils/telemetry.js';

// Convert lat/lng to 3D Cartesian coordinates on sphere of radius R
function latLngToVector3(lat, lng, radius) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

// Generate cybernetic continental land dots for high-end aesthetic
function generateContinentalDots(radius) {
  // Major global land bounding boxes [minLat, maxLat, minLng, maxLng]
  const landBoxes = [
    // North America
    [15, 68, -165, -55],
    // South America
    [-55, 12, -80, -35],
    // Europe
    [36, 70, -10, 42],
    // Africa
    [-35, 37, -18, 51],
    // Asia
    [6, 72, 42, 142],
    // Indian Subcontinent
    [8, 35, 68, 92],
    // Southeast Asia & Indonesia
    [-10, 20, 95, 140],
    // Australia & NZ
    [-45, -11, 113, 175],
    // Japan
    [30, 45, 128, 146],
    // United Kingdom & Ireland
    [50, 59, -10, 2],
  ];

  const points = [];
  const totalRays = 1800;
  const phiWeight = (Math.sqrt(5) - 1) / 2; // Golden ratio

  for (let i = 0; i < totalRays; i++) {
    const y = 1 - (i / (totalRays - 1)) * 2; // -1 to 1
    const radiusAtY = Math.sqrt(1 - y * y);
    const theta = 2 * Math.PI * phiWeight * i;

    const lat = Math.asin(y) * (180 / Math.PI);
    let lng = (theta * (180 / Math.PI)) % 360;
    if (lng > 180) lng -= 360;
    if (lng < -180) lng += 360;

    // Check if within any land boundary box
    let isLand = false;
    for (const [minLat, maxLat, minLng, maxLng] of landBoxes) {
      if (lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng) {
        // Exclude large ocean gaps inside boxes (e.g. Indian Ocean, Mid Atlantic)
        if (minLat >= 6 && maxLat <= 72 && minLng >= 42 && maxLng <= 142) {
          // Asia interior check - keep land
          isLand = true;
          break;
        }
        isLand = true;
        break;
      }
    }

    if (isLand) {
      const v = latLngToVector3(lat, lng, radius + 0.3);
      points.push(v.x, v.y, v.z);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  return geometry;
}

export default function GlobeView({ 
  geoPoints = [], 
  countries = [], 
  regions = [], 
  shortCode = '' 
}) {
  const containerRef = useRef(null);
  const tooltipRef = useRef(null);
  const sceneRef = useRef(null);
  const globeGroupRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const markersGroupRef = useRef(null);
  const interactiveMeshesRef = useRef([]);
  const animFrameIdRef = useRef(null);

  const [autoRotate, setAutoRotate] = useState(true);
  const [useSampleData, setUseSampleData] = useState(false);
  const [tooltipData, setTooltipData] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [focusedLocation, setFocusedLocation] = useState(null);

  // Active dataset: either real points, fallback synthesized points, or sample demo data
  const activePoints = useMemo(() => {
    if (useSampleData) return SAMPLE_GEO_POINTS;

    if (geoPoints && geoPoints.length > 0) {
      return geoPoints;
    }

    // Fallback: If geoPoints empty but regions exist, synthesize points from regions
    if (regions && regions.length > 0) {
      return regions.map((r) => {
        const coords = resolveCoordinates({ region: r.region, country: r.country });
        return {
          region: r.region,
          country: r.country,
          city: '',
          latitude: coords ? coords[0] : null,
          longitude: coords ? coords[1] : null,
          count: r.count,
        };
      });
    }

    // Fallback: If only countries exist, synthesize points from country centroids
    if (countries && countries.length > 0) {
      return countries.map((c) => {
        const centroid = COUNTRY_CENTROIDS[c.country?.toUpperCase()];
        return {
          region: 'All Regions',
          country: c.country,
          city: '',
          latitude: centroid ? centroid.lat : null,
          longitude: centroid ? centroid.lng : null,
          count: c.count,
        };
      });
    }

    return [];
  }, [geoPoints, regions, countries, useSampleData]);

  const maxClickCount = useMemo(() => {
    if (activePoints.length === 0) return 1;
    return Math.max(...activePoints.map((p) => p.count || 1), 1);
  }, [activePoints]);

  // Top locations for quick focus chips
  const topLocations = useMemo(() => {
    return [...activePoints]
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [activePoints]);

  // Set sample data default if url has 0 geo records
  useEffect(() => {
    if (geoPoints.length === 0 && (!countries || countries.length === 0)) {
      setUseSampleData(true);
    }
  }, [geoPoints.length, countries]);

  // ── Three.js Scene Lifecycle ───────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 2000);
    camera.position.set(0, 0, 230);
    cameraRef.current = camera;

    // 2. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 3. Globe Root Group
    const globeGroup = new THREE.Group();
    scene.add(globeGroup);
    globeGroupRef.current = globeGroup;

    const GLOBE_RADIUS = 88;

    // 4. Base Dark Glass Sphere
    const sphereGeometry = new THREE.SphereGeometry(GLOBE_RADIUS, 64, 64);
    const sphereMaterial = new THREE.MeshPhongMaterial({
      color: 0x070b14,
      emissive: 0x02050b,
      specular: 0x1e293b,
      shininess: 25,
      transparent: true,
      opacity: 0.94,
    });
    const globeMesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
    globeGroup.add(globeMesh);

    // 5. Subtle Coordinate Grid Lines
    const gridGroup = new THREE.Group();
    const gridMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.08,
      blending: THREE.AdditiveBlending,
    });

    // Latitude circles
    for (let lat = -60; lat <= 60; lat += 30) {
      const phi = (90 - lat) * (Math.PI / 180);
      const ringRadius = GLOBE_RADIUS * Math.sin(phi);
      const ringY = GLOBE_RADIUS * Math.cos(phi);
      const ringGeo = new THREE.BufferGeometry();
      const ringPts = [];
      const segments = 64;
      for (let s = 0; s <= segments; s++) {
        const theta = (s / segments) * Math.PI * 2;
        ringPts.push(ringRadius * Math.cos(theta), ringY, ringRadius * Math.sin(theta));
      }
      ringGeo.setAttribute('position', new THREE.Float32BufferAttribute(ringPts, 3));
      gridGroup.add(new THREE.Line(ringGeo, gridMat));
    }

    // Longitude meridians
    for (let lng = 0; lng < 360; lng += 45) {
      const meridianGeo = new THREE.BufferGeometry();
      const meridianPts = [];
      const segments = 64;
      const theta = lng * (Math.PI / 180);
      for (let s = 0; s <= segments; s++) {
        const phi = (s / segments) * Math.PI;
        const x = -(GLOBE_RADIUS * Math.sin(phi) * Math.cos(theta));
        const z = GLOBE_RADIUS * Math.sin(phi) * Math.sin(theta);
        const y = GLOBE_RADIUS * Math.cos(phi);
        meridianPts.push(x, y, z);
      }
      meridianGeo.setAttribute('position', new THREE.Float32BufferAttribute(meridianPts, 3));
      gridGroup.add(new THREE.Line(meridianGeo, gridMat));
    }
    globeGroup.add(gridGroup);

    // 6. Continental Dots Cloud
    const dotsGeo = generateContinentalDots(GLOBE_RADIUS);
    const dotsMat = new THREE.PointsMaterial({
      color: 0x94a3b8,
      size: 1.6,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
    });
    const continentPoints = new THREE.Points(dotsGeo, dotsMat);
    globeGroup.add(continentPoints);

    // 7. Outer Atmospheric Halo Glow
    const haloGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.045, 48, 48);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0x6366f1,
      transparent: true,
      opacity: 0.09,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
    });
    const atmosphereMesh = new THREE.Mesh(haloGeo, haloMat);
    globeGroup.add(atmosphereMesh);

    // 8. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0x818cf8, 1.8);
    dirLight1.position.set(300, 200, 250);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x38bdf8, 1.2);
    dirLight2.position.set(-300, -100, -250);
    scene.add(dirLight2);

    // 9. Markers Container
    const markersGroup = new THREE.Group();
    globeGroup.add(markersGroup);
    markersGroupRef.current = markersGroup;

    // 10. Mouse Drag & Orbit Interaction State
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;
    let velocityX = 0;
    let velocityY = 0;
    let targetRotationX = 0.05;
    let targetRotationY = -0.5;

    const onPointerDown = (e) => {
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
      velocityX = 0;
      velocityY = 0;
    };

    const onPointerMove = (e) => {
      if (isDragging) {
        const deltaX = e.clientX - prevMouseX;
        const deltaY = e.clientY - prevMouseY;
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;

        targetRotationY += deltaX * 0.005;
        targetRotationX += deltaY * 0.005;

        // Clamp vertical pitch to prevent flipping
        targetRotationX = Math.max(-Math.PI / 2.3, Math.min(Math.PI / 2.3, targetRotationX));

        velocityX = deltaX * 0.005;
        velocityY = deltaY * 0.005;
      }

      // Raycasting for marker tooltips
      const rect = renderer.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);

      const intersects = raycaster.intersectObjects(interactiveMeshesRef.current);
      if (intersects.length > 0) {
        const hit = intersects[0].object;
        const data = hit.userData;
        if (data && data.point) {
          setTooltipData(data);
          setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
          document.body.style.cursor = 'pointer';
          return;
        }
      }

      if (!isDragging) {
        setTooltipData(null);
        document.body.style.cursor = 'grab';
      }
    };

    const onPointerUp = () => {
      isDragging = false;
    };

    const onWheel = (e) => {
      e.preventDefault();
      const zoomSpeed = 0.15;
      camera.position.z += e.deltaY * zoomSpeed;
      camera.position.z = Math.max(160, Math.min(360, camera.position.z));
    };

    const domElement = renderer.domElement;
    domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    domElement.addEventListener('wheel', onWheel, { passive: false });

    // 11. Render Loop
    let clock = new THREE.Clock();

    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);

      // Auto-rotation when not interacting
      if (autoRotate && !isDragging) {
        targetRotationY += 0.0018;
      }

      // Smooth inertia damping
      globeGroup.rotation.y += (targetRotationY - globeGroup.rotation.y) * 0.08;
      globeGroup.rotation.x += (targetRotationX - globeGroup.rotation.x) * 0.08;

      // Pulse beacon markers
      const elapsedTime = clock.getElapsedTime();
      interactiveMeshesRef.current.forEach((mesh) => {
        if (mesh.userData?.baseScale) {
          const scale = mesh.userData.baseScale * (1 + 0.15 * Math.sin(elapsedTime * 3 + mesh.userData.pulseOffset));
          mesh.scale.set(scale, scale, scale);
        }
      });

      renderer.render(scene, camera);
    };

    animate();

    // 12. Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const newWidth = entry.contentRect.width;
        const newHeight = entry.contentRect.height;
        if (newWidth && newHeight) {
          camera.aspect = newWidth / newHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(newWidth, newHeight);
        }
      }
    });
    resizeObserver.observe(container);

    // Cleanup
    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      resizeObserver.disconnect();
      domElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      domElement.removeEventListener('wheel', onWheel);

      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      sphereGeometry.dispose();
      sphereMaterial.dispose();
      dotsGeo.dispose();
      dotsMat.dispose();
      haloGeo.dispose();
      haloMat.dispose();
    };
  }, [autoRotate]);

  // ── Plot 3D Geo Markers when Points or maxClickCount changes ───────────────
  useEffect(() => {
    const markersGroup = markersGroupRef.current;
    if (!markersGroup) return;

    // Clear existing markers
    while (markersGroup.children.length > 0) {
      const child = markersGroup.children[0];
      markersGroup.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
        else child.material.dispose();
      }
    }
    interactiveMeshesRef.current = [];

    const GLOBE_RADIUS = 88;

    activePoints.forEach((point, index) => {
      const coords = resolveCoordinates(point);
      if (!coords) return;

      const [lat, lng] = coords;
      const count = point.count || 1;
      const colorMeta = getMarkerColorByCount(count, maxClickCount);
      const hexColor = new THREE.Color(colorMeta.hex);

      // Height of 3D pillar proportional to visits count (6px to 38px)
      const pillarHeight = Math.min(38, Math.max(8, 8 + (count / maxClickCount) * 30));

      const surfacePos = latLngToVector3(lat, lng, GLOBE_RADIUS);
      const normal = surfacePos.clone().normalize();

      // 1. Elevated Pillar Cylinder
      const cylinderGeo = new THREE.CylinderGeometry(0.7, 1.3, pillarHeight, 8);
      // Offset geometry so base is at sphere surface
      cylinderGeo.translate(0, pillarHeight / 2, 0);

      const cylinderMat = new THREE.MeshPhongMaterial({
        color: hexColor,
        emissive: hexColor,
        emissiveIntensity: 0.6,
        transparent: true,
        opacity: 0.85,
        shininess: 30,
      });

      const pillarMesh = new THREE.Mesh(cylinderGeo, cylinderMat);
      pillarMesh.position.copy(surfacePos);
      pillarMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
      markersGroup.add(pillarMesh);

      // 2. Glowing Beacon Sphere at Top of Pillar
      const beaconRadius = Math.min(3.2, 1.8 + (count / maxClickCount) * 1.4);
      const beaconGeo = new THREE.SphereGeometry(beaconRadius, 16, 16);
      const beaconMat = new THREE.MeshStandardMaterial({
        color: hexColor,
        emissive: hexColor,
        emissiveIntensity: 0.9,
        roughness: 0.2,
      });

      const tipPos = surfacePos.clone().add(normal.clone().multiplyScalar(pillarHeight));
      const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
      beaconMesh.position.copy(tipPos);

      // Store metadata for raycasting & hover tooltips
      beaconMesh.userData = {
        point,
        colorMeta,
        lat,
        lng,
        count,
        baseScale: 1,
        pulseOffset: index * 0.4,
      };

      markersGroup.add(beaconMesh);
      interactiveMeshesRef.current.push(beaconMesh);

      // 3. Ground Ripple Ring at Surface Base
      const ringRadius = 3.2;
      const ringGeo = new THREE.RingGeometry(ringRadius * 0.6, ringRadius, 16);
      const ringMat = new THREE.MeshBasicMaterial({
        color: hexColor,
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.copy(surfacePos.clone().add(normal.clone().multiplyScalar(0.4)));
      ringMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
      markersGroup.add(ringMesh);
    });
  }, [activePoints, maxClickCount]);

  // ── Focus Globe on Location (State/Country) ───────────────────────────────
  const focusLocation = useCallback((point) => {
    const coords = resolveCoordinates(point);
    if (!coords || !globeGroupRef.current) return;

    const [lat, lng] = coords;
    setFocusedLocation(point);

    // Calculate target Y & X rotation angles to bring coordinates front-center
    const targetY = -((lng + 90) * (Math.PI / 180));
    const targetX = (lat - 10) * (Math.PI / 180);

    // Smoothly rotate globe
    const globe = globeGroupRef.current;
    const startY = globe.rotation.y;
    const startX = globe.rotation.x;
    const startTime = performance.now();
    const duration = 900; // ms

    const step = (time) => {
      const elapsed = time - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Ease out cubic
      const ease = 1 - Math.pow(1 - progress, 3);

      globe.rotation.y = startY + (targetY - startY) * ease;
      globe.rotation.x = startX + (targetX - startX) * ease;

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };
    requestAnimationFrame(step);
  }, []);

  // Reset Camera View
  const handleResetCamera = () => {
    if (!globeGroupRef.current || !cameraRef.current) return;
    globeGroupRef.current.rotation.set(0.05, -0.5, 0);
    cameraRef.current.position.set(0, 0, 230);
    setFocusedLocation(null);
  };

  return (
    <div className={styles.globeContainer}>
      {/* ── 3D Canvas Mount ──────────────────────────────────────────────── */}
      <div ref={containerRef} className={styles.canvasWrapper} />

      {/* ── Top Bar Controls ─────────────────────────────────────────────── */}
      <div className={styles.topOverlay}>
        <div className={styles.titleArea}>
          <span className={styles.globeIcon}>🌐</span>
          <div>
            <div className={styles.titleText}>Interactive Geographic Globe</div>
            <div className={styles.titleSub}>
              {activePoints.length} active {activePoints.length === 1 ? 'region' : 'regions'} plotted
            </div>
          </div>
          {useSampleData && (
            <span className={styles.sampleBadge}>Demo Preview Mode</span>
          )}
        </div>

        <div className={styles.toolbar}>
          <button
            type="button"
            className={`${styles.toolBtn} ${autoRotate ? styles.toolBtnActive : ''}`}
            onClick={() => setAutoRotate(!autoRotate)}
            title={autoRotate ? 'Pause auto-rotation' : 'Resume auto-rotation'}
          >
            {autoRotate ? '⏸️ Auto Spin' : '▶️ Spin'}
          </button>

          <button
            type="button"
            className={styles.toolBtn}
            onClick={handleResetCamera}
            title="Reset perspective"
          >
            🔄 Reset
          </button>

          <button
            type="button"
            className={`${styles.toolBtn} ${useSampleData ? styles.toolBtnActive : ''}`}
            onClick={() => setUseSampleData(!useSampleData)}
            title="Toggle between live telemetry and rich demo data"
          >
            ✨ {useSampleData ? 'Live Telemetry' : 'Demo Points'}
          </button>
        </div>
      </div>

      {/* ── Drag & Scroll Hint ───────────────────────────────────────────── */}
      <div className={styles.hintPill}>
        Drag to rotate · Scroll to zoom · Hover pins for details
      </div>

      {/* ── Floating Tooltip ─────────────────────────────────────────────── */}
      {tooltipData && (
        <div
          ref={tooltipRef}
          className={styles.tooltip}
          style={{
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y}px`,
          }}
        >
          <div className={styles.tooltipHeader}>
            <span className={styles.tooltipFlag}>
              {getCountryFlag(tooltipData.point.country)}
            </span>
            <span className={styles.tooltipRegion}>
              {getRegionLabel(tooltipData.point.region, tooltipData.point.country)}
            </span>
          </div>

          <div className={styles.tooltipCountry}>
            {tooltipData.point.city && tooltipData.point.city !== 'Unknown' && `${tooltipData.point.city}, `}
            {getCountryName(tooltipData.point.country)}
          </div>

          <div className={styles.tooltipCountRow}>
            <div>
              <span className={styles.tooltipCountVal}>
                {tooltipData.count} {tooltipData.count === 1 ? 'visit' : 'visits'}
              </span>
            </div>
            <span
              className={styles.tooltipTier}
              style={{
                color: tooltipData.colorMeta.hex,
                background: tooltipData.colorMeta.glow,
                border: `1px solid ${tooltipData.colorMeta.hex}`,
              }}
            >
              {tooltipData.colorMeta.tier} Intensity
            </span>
          </div>
        </div>
      )}

      {/* ── Bottom Overlay: Legend & Quick Focus Chips ───────────────────── */}
      <div className={styles.bottomOverlay}>
        {/* Color Legend Bar */}
        <div className={styles.legendBar}>
          <span className={styles.legendLabel}>Intensity:</span>
          <div className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: '#38bdf8' }} />
            <span>Low (1-2)</span>
          </div>
          <div className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: '#818cf8' }} />
            <span>Moderate (3-5)</span>
          </div>
          <div className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: '#ec4899' }} />
            <span>High (6-15)</span>
          </div>
          <div className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: '#f59e0b' }} />
            <span>Peak (16+)</span>
          </div>
        </div>

        {/* Quick Focus Location Chips */}
        {topLocations.length > 0 && (
          <div className={styles.focusList}>
            {topLocations.map((loc, idx) => {
              const label = getRegionLabel(loc.region, loc.country);
              const flag = getCountryFlag(loc.country);
              const isSelected = focusedLocation === loc;

              return (
                <button
                  key={`${loc.country}-${loc.region}-${idx}`}
                  type="button"
                  className={styles.focusChip}
                  style={isSelected ? { borderColor: '#818cf8', background: 'rgba(99, 102, 241, 0.3)' } : {}}
                  onClick={() => focusLocation(loc)}
                  title={`Focus on ${label}, ${getCountryName(loc.country)}`}
                >
                  <span>{flag}</span>
                  <span>{label}</span>
                  <span className={styles.focusCount}>{loc.count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
