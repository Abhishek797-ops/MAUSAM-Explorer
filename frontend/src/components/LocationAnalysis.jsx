import React, { useState, useRef, useEffect } from 'react';
import Globe from 'react-globe.gl';
import { getTimeSeries } from '../api/client';
import Plot from './PlotlyChart';
import { MapPin, X, TrendingUp, Thermometer, ArrowUpRight, ArrowDownRight } from 'lucide-react';

export default function LocationAnalysis({ meta, variable }) {
  const globeEl = useRef();
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [tsData, setTsData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [markers, setMarkers] = useState([]);

  useEffect(() => {
    if (!globeEl.current) return;
    const controls = globeEl.current.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.3;
  }, []);

  const handleGlobeClick = ({ lat, lng }) => {
    if (!variable) return;
    setLoading(true);
    setSelectedPoint({ lat: lat.toFixed(2), lon: lng.toFixed(2) });
    
    // Stop auto-rotate when user clicks
    if (globeEl.current) {
      globeEl.current.controls().autoRotate = false;
    }

    // Add marker
    setMarkers([{ lat, lng, size: 0.6, color: '#3b82f6' }]);

    getTimeSeries(variable, lat.toFixed(2), lng.toFixed(2)).then(data => {
      setTsData(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  const closePanel = () => {
    setSelectedPoint(null);
    setTsData(null);
    setMarkers([]);
    if (globeEl.current) {
      globeEl.current.controls().autoRotate = true;
    }
  };

  return (
    <div className="w-full h-full bg-[#0d1321] flex overflow-hidden">
      {/* Globe Area */}
      <div className={`${selectedPoint ? 'w-1/2' : 'w-full'} h-full relative transition-all duration-500`}>
        <Globe
          ref={globeEl}
          globeImageUrl="https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
          bumpImageUrl="https://unpkg.com/three-globe/example/img/earth-topology.png"
          backgroundImageUrl="https://unpkg.com/three-globe/example/img/night-sky.png"
          showAtmosphere={true}
          atmosphereColor="#4a90d9"
          atmosphereAltitude={0.15}
          onGlobeClick={handleGlobeClick}
          pointsData={markers}
          pointAltitude="size"
          pointRadius={0.8}
          pointColor="color"
          animateIn={true}
        />

        {/* Instruction Overlay */}
        {!selectedPoint && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 bg-black/60 backdrop-blur-xl px-6 py-3 rounded-2xl border border-white/10">
            <div className="flex items-center gap-2 text-xs text-white/60 font-bold">
              <MapPin size={14} className="text-blue-400" />
              Click anywhere on the globe to inspect location data
            </div>
          </div>
        )}
      </div>

      {/* Detail Panel */}
      {selectedPoint && (
        <div className="w-1/2 h-full bg-[#0d1321] border-l border-white/5 flex flex-col overflow-y-auto">
          {/* Panel Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
            <div>
              <h3 className="text-sm font-black text-white font-outfit">Location Analysis</h3>
              <p className="text-[10px] text-white/30 font-bold mt-1">
                {tsData?.lat}° N, {tsData?.lon}° E
              </p>
            </div>
            <button onClick={closePanel} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
              <X size={16} className="text-white/40" />
            </button>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : tsData && (
            <>
              {/* Historical Details */}
              <div className="p-6 border-b border-white/5">
                <h4 className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-4 flex items-center gap-2">
                  <Thermometer size={10} /> Historical Details
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <DetailCard label="Mean" value={tsData.mean} units={tsData.units} />
                  <DetailCard label="Maximum" value={tsData.max} units={tsData.units} color="text-red-400" icon={<ArrowUpRight size={12} />} />
                  <DetailCard label="Minimum" value={tsData.min} units={tsData.units} color="text-cyan-400" icon={<ArrowDownRight size={12} />} />
                  <DetailCard label="Std Dev" value={tsData.std} units={tsData.units} color="text-amber-400" />
                </div>
              </div>

              {/* Time Series Chart */}
              <div className="p-6 border-b border-white/5">
                <h4 className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-4 flex items-center gap-2">
                  <TrendingUp size={10} /> Temporal Profile
                </h4>
                <Plot
                  data={[{
                    x: tsData.times,
                    y: tsData.values,
                    type: 'scatter',
                    mode: 'lines',
                    line: { color: '#3b82f6', width: 2, shape: 'spline' },
                    fill: 'tozeroy',
                    fillcolor: 'rgba(59,130,246,0.08)',
                  }]}
                  layout={{
                    paper_bgcolor: 'transparent',
                    plot_bgcolor: 'transparent',
                    font: { family: 'Inter', color: '#94a3b8', size: 10 },
                    margin: { t: 10, b: 40, l: 45, r: 10 },
                    xaxis: { gridcolor: 'rgba(255,255,255,0.05)' },
                    yaxis: {
                      gridcolor: 'rgba(255,255,255,0.05)',
                      title: { text: tsData.units, font: { size: 9 } }
                    },
                    height: 200,
                    showlegend: false,
                    hovermode: 'x unified',
                  }}
                  config={{ displayModeBar: false, responsive: true }}
                  style={{ width: '100%' }}
                  useResizeHandler={true}
                />
              </div>

              {/* 5-Year Averages */}
              <div className="p-6">
                <h4 className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-4">Period Averages</h4>
                <div className="space-y-2">
                  {computePeriodAverages(tsData.times, tsData.values).map((period, i) => (
                    <div key={i} className="flex items-center justify-between bg-white/[0.03] px-3 py-2 rounded-xl">
                      <span className="text-[10px] text-white/40 font-bold">{period.label}</span>
                      <span className="text-xs font-black text-blue-400 font-outfit">{period.avg} <span className="text-[9px] text-white/20">{tsData.units}</span></span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function DetailCard({ label, value, units, color = "text-blue-400", icon }) {
  return (
    <div className="bg-white/[0.03] p-3 rounded-xl border border-white/5">
      <div className="text-[8px] font-black uppercase tracking-widest text-white/25 flex items-center gap-1">{icon}{label}</div>
      <div className={`text-lg font-black font-outfit ${color} mt-1`}>
        {value} <span className="text-[9px] text-white/20">{units}</span>
      </div>
    </div>
  );
}

function computePeriodAverages(times, values) {
  if (!times || !values || times.length === 0) return [];
  
  const yearMap = {};
  times.forEach((t, i) => {
    const year = parseInt(t.split('-')[0]);
    if (!yearMap[year]) yearMap[year] = [];
    yearMap[year].push(values[i]);
  });

  const years = Object.keys(yearMap).map(Number).sort();
  if (years.length < 2) return [{ label: `${years[0]}`, avg: (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2) }];

  const periods = [];
  for (let i = 0; i < years.length; i += 5) {
    const periodYears = years.slice(i, i + 5);
    const periodVals = periodYears.flatMap(y => yearMap[y]);
    const avg = periodVals.reduce((a, b) => a + b, 0) / periodVals.length;
    periods.push({
      label: `${periodYears[0]}–${periodYears[periodYears.length - 1]}`,
      avg: avg.toFixed(2)
    });
  }
  return periods;
}
