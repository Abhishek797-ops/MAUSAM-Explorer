import React, { useMemo, useState, useEffect, useRef } from 'react';
import Globe from 'react-globe.gl';
import * as THREE from 'three';
import { Thermometer, Droplets, Wind, MapPin, X } from 'lucide-react';

export default function ClimateProfile({ spatialData, meta, variable, onVariableChange, loading }) {
  const globeEl = useRef();
  const [activeLayer, setActiveLayer] = useState('temperature');
  const [heatmapMesh, setHeatmapMesh] = useState(null);
  
  // Interactive Location State
  const [clickedLocation, setClickedLocation] = useState(null);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);

  useEffect(() => {
    if (!globeEl.current) return;
    const controls = globeEl.current.controls();
    if (controls) {
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.4;
    }
  }, []);

  const heatmapUrl = useMemo(() => {
    if (variable && spatialData) {
       return `/api/heatmap?variable=${variable}&time_index=${spatialData?.meta?.timeIndex || 0}&t=${Date.now()}`;
    }
    return null;
  }, [variable, spatialData]);

  useEffect(() => {
    if (!heatmapUrl) return;

    const loader = new THREE.TextureLoader();
    loader.load(heatmapUrl, (texture) => {
      const geometry = new THREE.SphereGeometry(100 * 1.002, 64, 64);
      const material = new THREE.MeshPhongMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        blending: THREE.NormalBlending
      });
      
      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.y = -Math.PI / 2;

      setHeatmapMesh((prevMesh) => {
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
    };
  }, [heatmapMesh]);

  const MAJOR_CITIES = [
    { name: 'New York', lat: 40.71, lng: -74.00, size: 0.5 },
    { name: 'London', lat: 51.50, lng: -0.12, size: 0.5 },
    { name: 'Tokyo', lat: 35.67, lng: 139.65, size: 0.5 },
    { name: 'Sydney', lat: -33.86, lng: 151.20, size: 0.5 },
    { name: 'Mumbai', lat: 19.07, lng: 72.87, size: 0.5 },
    { name: 'Cairo', lat: 30.04, lng: 31.23, size: 0.5 },
    { name: 'São Paulo', lat: -23.55, lng: -46.63, size: 0.5 },
    { name: 'Moscow', lat: 55.75, lng: 37.61, size: 0.5 },
    { name: 'Beijing', lat: 39.90, lng: 116.40, size: 0.5 },
    { name: 'Paris', lat: 48.85, lng: 2.35, size: 0.5 },
    { name: 'Johannesburg', lat: -26.20, lng: 28.04, size: 0.5 },
    { name: 'Los Angeles', lat: 34.05, lng: -118.24, size: 0.5 },
    { name: 'Dubai', lat: 25.20, lng: 55.27, size: 0.5 },
    { name: 'Singapore', lat: 1.35, lng: 103.81, size: 0.5 }
  ];

  const handleGlobeClick = async ({ lat, lng }) => {
    if (!spatialData?.data) return;
    setClickedLocation(null);
    setIsFetchingLocation(true);

    // 1. Find the nearest spatial data point for the exact climate value
    const nearest = spatialData.data.reduce((prev, curr) => {
      const prevDist = Math.pow(prev.lat - lat, 2) + Math.pow(prev.lon - lng, 2);
      const currDist = Math.pow(curr.lat - lat, 2) + Math.pow(curr.lon - lng, 2);
      return prevDist < currDist ? prev : curr;
    });

    // 2. Reverse geocode the coordinate using OpenStreetMap
    let placeName = "Unknown Location";
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10`, {
        headers: { 'User-Agent': 'MAUSAM-Explorer/1.0' }
      });
      if (res.ok) {
        const data = await res.json();
        const address = data.address || {};
        const localArea = address.city || address.town || address.village || address.hamlet || address.county;
        const region = address.state || address.country;
        
        if (localArea && region && localArea !== region) {
          placeName = `${localArea}, ${region}`;
        } else if (localArea || region) {
          placeName = localArea || region;
        } else {
          placeName = "Ocean / Remote Area";
        }
      }
    } catch (e) {
      console.warn("Geocoding failed", e);
    }

    setClickedLocation({
      lat: lat.toFixed(2),
      lon: lng.toFixed(2),
      name: placeName,
      value: nearest.value,
      units: spatialData.meta.units
    });
    setIsFetchingLocation(false);
  };

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
        onGlobeClick={handleGlobeClick}
        labelsData={MAJOR_CITIES}
        labelLat="lat"
        labelLng="lng"
        labelText="name"
        labelSize={1.5}
        labelDotRadius={0.4}
        labelColor={() => 'rgba(255,255,255,0.7)'}
        labelResolution={2}
        htmlElementsData={clickedLocation ? [clickedLocation] : []}
        htmlLat="lat"
        htmlLng="lon"
        htmlElement={() => {
          const el = document.createElement('div');
          el.innerHTML = `<div class="w-4 h-4 rounded-full bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.8)] border-2 border-white animate-bounce flex items-center justify-center -translate-y-2"></div>`;
          return el;
        }}
      />

      {/* Stats Overlay */}
      {spatialData && (() => {
        const isKelvin = spatialData.meta.units === 'K' || spatialData.meta.units === 'Kelvin';
        const offset = isKelvin ? 273.15 : 0;
        const displayUnits = isKelvin ? '°C' : spatialData.meta.units;
        const meanObj = spatialData.data.reduce((a, b) => a + b.value, 0) / spatialData.data.length;

        return (
          <div className="absolute top-4 right-4 z-20 space-y-3">
            <StatBadge label="Mean" value={(meanObj - offset).toFixed(2)} units={displayUnits} />
            <StatBadge label="Max" value={(spatialData.meta.max - offset).toFixed(2)} units={displayUnits} color="text-red-400" />
            <StatBadge label="Min" value={(spatialData.meta.min - offset).toFixed(2)} units={displayUnits} color="text-cyan-400" />
            <StatBadge label="Points" value={spatialData.data.length.toLocaleString()} units="PTS" color="text-indigo-400" />
          </div>
        );
      })()}

      {/* Color Legend */}
      {spatialData && (() => {
        const isKelvin = spatialData.meta.units === 'K' || spatialData.meta.units === 'Kelvin';
        const offset = isKelvin ? 273.15 : 0;
        
        return (
          <div className="absolute bottom-6 right-6 z-20 bg-black/60 backdrop-blur-xl p-4 rounded-2xl border border-white/10 flex flex-col items-end">
            <div className="text-[9px] font-bold uppercase tracking-widest text-white/40 mb-2 text-right">Intensity</div>
            <div className="flex gap-3">
              <div className="flex flex-col justify-between items-end h-32">
                <span className="text-[10px] text-white/70 font-bold">{(spatialData.meta.max - offset).toFixed(1)}</span>
                <span className="text-[10px] text-white/70 font-bold">{(spatialData.meta.min - offset).toFixed(1)}</span>
              </div>
              <div className="h-32 w-3 bg-gradient-to-t from-blue-600 via-yellow-400 to-red-500 rounded-full shadow-inner"></div>
            </div>
          </div>
        );
      })()}

      {/* Interactive Location Popup */}
      {(clickedLocation || isFetchingLocation) && (
        <div className="absolute bottom-6 left-6 z-20 bg-black/80 backdrop-blur-2xl p-5 rounded-2xl border border-blue-500/30 shadow-[0_0_30px_rgba(59,130,246,0.15)] w-72 animate-in slide-in-from-bottom-5">
          <button 
            onClick={() => setClickedLocation(null)}
            className="absolute top-3 right-3 p-1 hover:bg-white/10 rounded-lg text-white/40 transition-colors"
          >
            <X size={14} />
          </button>
          
          <h3 className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-4 flex items-center gap-1.5">
            <MapPin size={12} /> Point Inspection
          </h3>
          
          {isFetchingLocation ? (
            <div className="flex items-center gap-3 py-2">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-bold text-white/60 font-outfit">Triangulating...</span>
            </div>
          ) : clickedLocation && (
            <div className="space-y-4">
              <div>
                <div className="text-xl font-black text-white font-outfit leading-tight break-words">
                  {clickedLocation.name}
                </div>
                <div className="text-[10px] font-mono text-white/40 mt-1">
                  {clickedLocation.lat}°N, {clickedLocation.lon}°E
                </div>
              </div>
              
              <div className="bg-white/5 p-3 rounded-xl border border-white/5 flex items-center justify-between">
                <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Reading</span>
                <div className="text-lg font-black text-white font-outfit">
                  {clickedLocation.units === 'K' || clickedLocation.units === 'Kelvin' 
                    ? (clickedLocation.value - 273.15).toFixed(2) 
                    : clickedLocation.value.toFixed(2)}
                  <span className="text-[10px] text-white/30 ml-1">
                    {clickedLocation.units === 'K' || clickedLocation.units === 'Kelvin' ? '°C' : clickedLocation.units}
                  </span>
                </div>
              </div>
            </div>
          )}
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
