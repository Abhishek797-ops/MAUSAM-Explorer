import React, { useRef, useEffect, useMemo } from 'react';
import Globe from 'react-globe.gl';

export default function MapboxGlobe({ data, meta, loading }) {
  const globeEl = useRef();

  useEffect(() => {
    if (!globeEl.current) return;
    const controls = globeEl.current.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;
  }, []);

  // Convert spatial data to heatmap points
  const heatmapData = useMemo(() => {
    if (!data) return [];
    return data.map(d => ({
      lat: d.lat,
      lng: d.lon,
      alt: 0.01,
      radius: 1.5,
      color: getColor(d.value, meta.min, meta.max)
    }));
  }, [data, meta]);

  return (
    <div className="w-full h-full relative bg-slate-900">
      <Globe
        ref={globeEl}
        globeImageUrl="https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        bumpImageUrl="https://unpkg.com/three-globe/example/img/earth-topology.png"
        backgroundImageUrl="https://unpkg.com/three-globe/example/img/night-sky.png"
        showAtmosphere={true}
        atmosphereColor="#4a90d9"
        atmosphereAltitude={0.2}

        pointsData={heatmapData}
        pointAltitude="alt"
        pointRadius="radius"
        pointColor="color"
        pointsMerge={true}

        animateIn={true}
      />

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="mt-4 text-xs font-black uppercase tracking-widest text-blue-400">Processing...</p>
          </div>
        </div>
      )}

      {/* Color Legend */}
      <div className="absolute bottom-8 right-8 bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-2xl border border-white flex flex-col gap-2 z-10">
        <div className="text-[10px] font-black uppercase tracking-tighter text-slate-400 border-b pb-2 mb-1">Intensity Scale</div>
        <div className="h-40 w-4 bg-gradient-to-t from-blue-900 via-blue-400 to-yellow-300 rounded-full relative">
          <span className="absolute -top-1 left-6 text-[10px] font-bold text-slate-500">{meta?.max?.toFixed(1)}</span>
          <span className="absolute -bottom-1 left-6 text-[10px] font-bold text-slate-500">{meta?.min?.toFixed(1)}</span>
        </div>
      </div>
    </div>
  );
}

function getColor(value, min, max) {
  const t = (value - min) / (max - min);
  const r = Math.round(t * 255);
  const g = Math.round((1 - t) * 100 + 50);
  const b = Math.round((1 - t) * 255);
  return `rgba(${r}, ${g}, ${b}, 0.8)`;
}
