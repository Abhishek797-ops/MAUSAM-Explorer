import React, { useRef, useEffect, useState, useCallback } from 'react';
import Globe from 'react-globe.gl';

export default function GlobeVisual() {
  const globeEl = useRef();
  const [countries, setCountries] = useState([]);
  const [hoverD, setHoverD] = useState(null);
  const [tooltip, setTooltip] = useState({ show: false, x: 0, y: 0, name: '' });

  // Load country polygons for hover detection
  useEffect(() => {
    fetch('https://raw.githubusercontent.com/vasturiano/react-globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson')
      .then(res => res.json())
      .then(data => {
        setCountries(data.features);
      });
  }, []);

  // Auto-rotation
  useEffect(() => {
    if (!globeEl.current) return;
    const controls = globeEl.current.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.8;
    controls.enableZoom = false;
  }, []);

  const handlePolygonHover = useCallback((polygon, event) => {
    setHoverD(polygon);
    if (polygon) {
      const name = polygon.properties.ADMIN || polygon.properties.NAME || 'Unknown';
      setTooltip({
        show: true,
        x: event?.clientX || 0,
        y: event?.clientY || 0,
        name
      });
    } else {
      setTooltip({ show: false, x: 0, y: 0, name: '' });
    }
  }, []);

  return (
    <div className="w-full h-full bg-[#060b18] relative overflow-hidden">
      <Globe
        ref={globeEl}
        globeImageUrl="https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        bumpImageUrl="https://unpkg.com/three-globe/example/img/earth-topology.png"
        backgroundImageUrl="https://unpkg.com/three-globe/example/img/night-sky.png"

        showAtmosphere={true}
        atmosphereColor="#4a90d9"
        atmosphereAltitude={0.25}

        polygonsData={countries}
        polygonAltitude={d => d === hoverD ? 0.04 : 0.01}
        polygonCapColor={d => d === hoverD ? 'rgba(59, 130, 246, 0.35)' : 'rgba(255, 255, 255, 0.03)'}
        polygonSideColor={() => 'rgba(59, 130, 246, 0.1)'}
        polygonStrokeColor={() => 'rgba(59, 130, 246, 0.15)'}
        polygonLabel={d => {
          const name = d.properties.ADMIN || d.properties.NAME;
          return `
            <div style="
              background: rgba(10,15,29,0.95);
              backdrop-filter: blur(20px);
              border: 1px solid rgba(59,130,246,0.3);
              border-radius: 16px;
              padding: 14px 22px;
              font-family: 'Outfit', sans-serif;
              box-shadow: 0 20px 60px rgba(0,0,0,0.5), 0 0 30px rgba(59,130,246,0.15);
            ">
              <div style="font-size:16px;font-weight:800;color:#fff;letter-spacing:-0.5px;">${name}</div>
              <div style="font-size:9px;font-weight:700;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:3px;margin-top:4px;">Region</div>
            </div>
          `;
        }}
        onPolygonHover={handlePolygonHover}

        polygonsTransitionDuration={300}
        animateIn={true}
        width={typeof window !== 'undefined' ? window.innerWidth / 2 : 800}
        height={typeof window !== 'undefined' ? window.innerHeight : 900}
      />

      {/* Cinematic Glow Overlays */}
      <div className="absolute inset-0 pointer-events-none z-10">
        {/* Atmospheric Glow Ring */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[62vh] h-[62vh] rounded-full border border-blue-400/20 shadow-[0_0_120px_rgba(59,130,246,0.15)]" />
        {/* Blur Aura */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[68vh] h-[68vh] rounded-full bg-blue-500/5 blur-[100px]" />
      </div>

      {/* Edge Gradients */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_35%,#060b18_75%)] z-[5] pointer-events-none" />
    </div>
  );
}
