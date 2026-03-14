import React, { useMemo, useState, useEffect, useRef } from 'react';
import Globe from 'react-globe.gl';
import * as THREE from 'three';
import { Thermometer, Droplets, Wind } from 'lucide-react';

export default function ClimateProfile({ spatialData, meta, variable, onVariableChange, loading }) {
  const globeEl = useRef();
  const [activeLayer, setActiveLayer] = useState('temperature');
  const [heatmapMesh, setHeatmapMesh] = useState(null);

  useEffect(() => {
    if (!globeEl.current) return;
    const controls = globeEl.current.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.3;
  }, []);

  const heatmapUrl = useMemo(() => {
    if (variable && spatialData) {
       // Ensure we grab fresh image when spatialData updates
       return `/api/heatmap?variable=${variable}&time_index=${spatialData?.meta?.timeIndex || 0}&t=${Date.now()}`;
    }
    return null;
  }, [variable, spatialData]);

  useEffect(() => {
    if (!heatmapUrl) return;

    const loader = new THREE.TextureLoader();
    loader.load(heatmapUrl, (texture) => {
      // react-globe.gl uses a radius of 100 for the earth
      const geometry = new THREE.SphereGeometry(100 * 1.002, 64, 64);
      const material = new THREE.MeshPhongMaterial({
        map: texture,
        transparent: true,
        depthWrite: false, // Ensures it doesn't z-fight with the base globe
        blending: THREE.NormalBlending
      });
      
      const mesh = new THREE.Mesh(geometry, material);
      // three-globe rotates the earth by -PI/2 so the PM matches the texture
      mesh.rotation.y = -Math.PI / 2;

      setHeatmapMesh((prevMesh) => {
        // Discard old geometry/material completely to avoid memory leaks
        if (prevMesh) {
           prevMesh.geometry.dispose();
           prevMesh.material.dispose();
        }
        return mesh;
      });
    });
  }, [heatmapUrl]);

  useEffect(() => {
    if (!globeEl.current || !heatmapMesh) return;
    const scene = globeEl.current.scene();
    scene.add(heatmapMesh);

    return () => {
      scene.remove(heatmapMesh);
      // Wait to dispose until replaced to prevent popping, but cleanup on unmount
    };
  }, [heatmapMesh]);

  const layers = [
    { id: 'temperature', label: 'Temperature Layers', icon: <Thermometer size={14} /> },
    { id: 'precipitation', label: 'Precipitation Layers', icon: <Droplets size={14} /> },
    { id: 'pressure', label: 'Pressure Layers', icon: <Wind size={14} /> },
  ];

  return (
    <div className="w-full h-full relative bg-slate-900 overflow-hidden">
      {/* Layer Toggles */}
      <div className="absolute top-4 left-4 z-20 flex gap-2">
        {layers.map(layer => (
          <button
            key={layer.id}
            onClick={() => {
              setActiveLayer(layer.id);
              if (meta?.variables?.includes(layer.id)) {
                onVariableChange(layer.id);
              }
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeLayer === layer.id
                ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                : 'bg-white/10 text-white/60 hover:bg-white/20 backdrop-blur-md'
            }`}
          >
            {layer.icon} {layer.label}
          </button>
        ))}
      </div>

      {/* Globe */}
      <Globe
        ref={globeEl}
        globeImageUrl="https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        bumpImageUrl="https://unpkg.com/three-globe/example/img/earth-topology.png"
        backgroundImageUrl="https://unpkg.com/three-globe/example/img/night-sky.png"
        showAtmosphere={true}
        atmosphereColor="#4a90d9"
        atmosphereAltitude={0.15}
        animateIn={true}
      />

      {/* Stats Overlay */}
      {spatialData && (
        <div className="absolute top-4 right-4 z-20 space-y-3">
          <StatBadge label="Mean" value={
            (spatialData.data.reduce((a, b) => a + b.value, 0) / spatialData.data.length).toFixed(2)
          } units={spatialData.meta.units} />
          <StatBadge label="Max" value={spatialData.meta.max.toFixed(2)} units={spatialData.meta.units} color="text-red-400" />
          <StatBadge label="Min" value={spatialData.meta.min.toFixed(2)} units={spatialData.meta.units} color="text-cyan-400" />
          <StatBadge label="Points" value={spatialData.data.length.toLocaleString()} units="PTS" color="text-indigo-400" />
        </div>
      )}

      {/* Color Legend */}
      {spatialData && (
        <div className="absolute bottom-6 right-6 z-20 bg-black/60 backdrop-blur-xl p-4 rounded-2xl border border-white/10 flex flex-col items-end">
          <div className="text-[9px] font-bold uppercase tracking-widest text-white/40 mb-2 text-right">Intensity</div>
          <div className="flex gap-3">
            <div className="flex flex-col justify-between items-end h-32">
              <span className="text-[10px] text-white/70 font-bold">{spatialData.meta.max.toFixed(1)}</span>
              <span className="text-[10px] text-white/70 font-bold">{spatialData.meta.min.toFixed(1)}</span>
            </div>
            <div className="h-32 w-3 bg-gradient-to-t from-blue-600 via-yellow-400 to-red-500 rounded-full shadow-inner"></div>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}

function StatBadge({ label, value, units, color = "text-blue-400" }) {
  return (
    <div className="bg-black/60 backdrop-blur-xl px-4 py-3 rounded-xl border border-white/10 min-w-[140px]">
      <div className="text-[9px] font-bold uppercase tracking-widest text-white/30">{label}</div>
      <div className="flex items-baseline gap-1 mt-1">
        <span className={`text-lg font-black font-outfit ${color}`}>{value}</span>
        <span className="text-[9px] text-white/30 font-bold uppercase">{units}</span>
      </div>
    </div>
  );
}

function getHeatColor(value, min, max) {
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  // Blue → Yellow → Red
  const r = Math.round(t < 0.5 ? t * 2 * 255 : 255);
  const g = Math.round(t < 0.5 ? t * 2 * 200 : (1 - t) * 2 * 200);
  const b = Math.round(t < 0.5 ? (1 - t * 2) * 255 : 0);
  return `rgba(${r}, ${g}, ${b}, 0.8)`;
}
