import React, { useState } from 'react';
import Plot from './PlotlyChart';
import { Search, X, MapPin, Loader, GitCompareArrows, BarChart3 } from 'lucide-react';

const LOCATION_COLORS = ['#3b82f6', '#f59e0b', '#10b981']; // blue, amber, green
const LOCATION_BG = ['rgba(59,130,246,0.15)', 'rgba(245,158,11,0.15)', 'rgba(16,185,129,0.15)'];

export default function ComparisonView({ meta, timeRange }) {
  const [locations, setLocations] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [comparisonData, setComparisonData] = useState(null);
  const [loading, setLoading] = useState(false);

  const searchLocation = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await res.json();
      setSearchResults(data);
    } catch (err) {
      console.error('Search failed:', err);
      setSearchResults([]);
    }
    setSearching(false);
  };

  const addLocation = (result) => {
    if (locations.length >= 3) return;
    const shortName = result.display_name.split(',')[0];
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);
    // Prevent duplicates
    if (locations.find(l => l.name === shortName)) return;
    setLocations(prev => [...prev, { name: shortName, lat, lon }]);
    setSearchResults([]);
    setSearchQuery('');
    setComparisonData(null); // reset old comparison
  };

  const removeLocation = (idx) => {
    setLocations(prev => prev.filter((_, i) => i !== idx));
    setComparisonData(null);
  };

  const runComparison = async () => {
    if (locations.length < 2) return;
    setLoading(true);
    try {
      const res = await fetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locations,
          start_time_index: timeRange[0],
          end_time_index: timeRange[1]
        })
      });
      const data = await res.json();
      setComparisonData(data.comparisons);
    } catch (err) {
      console.error('Comparison failed:', err);
    }
    setLoading(false);
  };

  return (
    <div className="w-full h-full bg-[#0d1321] flex overflow-hidden">
      {/* Left Panel: Location Selector */}
      <div className="w-80 border-r border-white/5 flex flex-col overflow-y-auto">
        {/* Search */}
        <div className="p-5 border-b border-white/5">
          <h3 className="text-xs font-black uppercase tracking-widest text-white/40 mb-4 flex items-center gap-2">
            <GitCompareArrows size={12} /> Select Locations
          </h3>
          <p className="text-[10px] text-white/30 mb-3">Search and add up to 3 locations to compare all variables.</p>
          <div className="relative mb-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchLocation()}
              placeholder="Search city, country..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 pl-9 text-xs text-white placeholder-white/30 outline-none focus:ring-1 focus:ring-blue-500 transition-all"
            />
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            {searching && <Loader size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-400 animate-spin" />}
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="bg-[#131b2e] rounded-xl border border-white/5 overflow-hidden mb-3">
              {searchResults.map((r, i) => (
                <button
                  key={i}
                  onClick={() => addLocation(r)}
                  disabled={locations.length >= 3}
                  className="w-full text-left px-3 py-2.5 text-[11px] text-white/60 hover:bg-white/5 hover:text-white transition-all border-b border-white/5 last:border-none disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <MapPin size={10} className="inline mr-1.5 text-blue-400" />
                  {r.display_name.substring(0, 60)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected Locations */}
        <div className="p-5 border-b border-white/5">
          <h4 className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-3">
            Selected ({locations.length}/3)
          </h4>
          {locations.length === 0 ? (
            <p className="text-[10px] text-white/20 italic">No locations added yet.</p>
          ) : (
            <div className="space-y-2">
              {locations.map((loc, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl border"
                  style={{ backgroundColor: LOCATION_BG[i], borderColor: LOCATION_COLORS[i] + '40' }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: LOCATION_COLORS[i] }} />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">{loc.name}</div>
                      <div className="text-[9px] text-white/30">{loc.lat.toFixed(2)}, {loc.lon.toFixed(2)}</div>
                    </div>
                  </div>
                  <button onClick={() => removeLocation(i)} className="text-white/30 hover:text-red-400 transition-colors shrink-0">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Compare Button */}
        <div className="p-5">
          <button
            onClick={runComparison}
            disabled={locations.length < 2 || loading}
            className="w-full py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-white/5 disabled:text-white/20 rounded-xl text-xs font-bold text-white transition-all shadow-lg shadow-blue-500/20 disabled:shadow-none flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader size={14} className="animate-spin" /> Comparing...
              </>
            ) : (
              <>
                <BarChart3 size={14} /> Compare Locations
              </>
            )}
          </button>
          {locations.length < 2 && locations.length > 0 && (
            <p className="text-[9px] text-amber-400/60 text-center mt-2">Add at least 2 locations to compare.</p>
          )}
        </div>
      </div>

      {/* Right Panel: Results */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        {!comparisonData ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-12">
            <div className="w-20 h-20 bg-blue-500/10 rounded-3xl flex items-center justify-center mb-6">
              <GitCompareArrows size={32} className="text-blue-400" />
            </div>
            <h3 className="text-lg font-bold text-white/70 font-outfit mb-2">Multi-Location Comparison</h3>
            <p className="text-xs text-white/30 max-w-sm leading-relaxed">
              Add 2 or 3 locations from the left panel, then click <strong className="text-blue-400">Compare</strong> to see how all climate variables stack up across your chosen locations.
            </p>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Radar / Spider Chart — Normalized Overview */}
            <div className="bg-white/[0.03] rounded-2xl border border-white/5 p-5">
              <h3 className="text-xs font-black uppercase tracking-widest text-white/40 mb-1">Climate Fingerprint</h3>
              <p className="text-[9px] text-white/20 mb-3">All variables normalized to 0–100% scale for cross-variable comparison.</p>
              <Plot
                data={locations.map((loc, li) => {
                  const varNames = comparisonData.map(r => r.long_name || r.variable);
                  const rawValues = comparisonData.map(r => {
                    const found = r.locations.find(l => l.name === loc.name);
                    return found?.value ?? 0;
                  });
                  // Normalize each variable across all locations to 0-100
                  const normalized = comparisonData.map((r, vi) => {
                    const allVals = r.locations.map(l => l.value).filter(v => v !== null);
                    const minV = Math.min(...allVals);
                    const maxV = Math.max(...allVals);
                    const range = maxV - minV || 1;
                    return ((rawValues[vi] - minV) / range) * 100;
                  });
                  return {
                    type: 'scatterpolar',
                    r: [...normalized, normalized[0]], // close the polygon
                    theta: [...varNames, varNames[0]],
                    fill: 'toself',
                    fillcolor: LOCATION_COLORS[li] + '15',
                    name: loc.name,
                    line: { color: LOCATION_COLORS[li], width: 2 },
                    marker: { size: 4, color: LOCATION_COLORS[li] },
                  };
                })}
                layout={{
                  paper_bgcolor: 'transparent',
                  plot_bgcolor: 'transparent',
                  font: { family: 'Inter, sans-serif', color: '#94a3b8', size: 10 },
                  margin: { t: 40, b: 40, l: 60, r: 60 },
                  polar: {
                    bgcolor: 'transparent',
                    radialaxis: {
                      visible: true,
                      range: [0, 100],
                      gridcolor: 'rgba(255,255,255,0.08)',
                      linecolor: 'rgba(255,255,255,0.05)',
                      tickfont: { size: 8, color: '#475569' },
                    },
                    angularaxis: {
                      gridcolor: 'rgba(255,255,255,0.08)',
                      linecolor: 'rgba(255,255,255,0.1)',
                      tickfont: { size: 9, color: '#94a3b8' },
                    },
                  },
                  height: 380,
                  showlegend: true,
                  legend: {
                    x: 0.5, xanchor: 'center', y: -0.05, yanchor: 'top',
                    orientation: 'h',
                    font: { color: '#94a3b8', size: 11 },
                    bgcolor: 'transparent',
                  },
                }}
                config={{ displayModeBar: false, responsive: true }}
                style={{ width: '100%' }}
                useResizeHandler={true}
              />
            </div>

            {/* Summary Table */}
            <div className="bg-white/[0.03] rounded-2xl border border-white/5 overflow-hidden">
              <div className="px-5 py-3 border-b border-white/5">
                <h3 className="text-xs font-black uppercase tracking-widest text-white/40">Summary Table</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#131b2e]">
                      <th className="text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest text-white/30 sticky left-0 bg-[#131b2e] z-10">Variable</th>
                      <th className="text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest text-white/30">Units</th>
                      {locations.map((loc, i) => (
                        <th key={i} className="text-right px-4 py-3 text-[9px] font-black uppercase tracking-widest" style={{ color: LOCATION_COLORS[i] }}>
                          {loc.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonData.map((row, ri) => (
                      <tr key={ri} className="border-t border-white/5 hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-2.5 text-white/60 font-bold sticky left-0 bg-[#0d1321] z-10">{row.long_name || row.variable}</td>
                        <td className="px-4 py-2.5 text-white/30">{row.units}</td>
                        {row.locations.map((loc, li) => (
                          <td key={li} className="px-4 py-2.5 text-right font-black font-outfit" style={{ color: LOCATION_COLORS[li] }}>
                            {loc.value !== null ? loc.value : '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Horizontal Bar Charts — one per variable (better for comparing) */}
            {comparisonData.map((row, ri) => {
              const allVals = row.locations.map(l => l.value).filter(v => v !== null);
              const maxAbsVal = Math.max(...allVals.map(Math.abs), 0.001);
              return (
                <div key={ri} className="bg-white/[0.03] rounded-2xl border border-white/5 p-5">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-4">
                    {row.long_name || row.variable} <span className="text-white/20 normal-case tracking-normal">({row.units})</span>
                  </h4>
                  {/* Custom horizontal bar visual */}
                  <div className="space-y-3">
                    {row.locations.map((loc, li) => {
                      const pct = loc.value !== null ? Math.abs(loc.value / maxAbsVal) * 100 : 0;
                      return (
                        <div key={li} className="flex items-center gap-3">
                          <div className="w-24 text-right text-[10px] font-bold shrink-0" style={{ color: LOCATION_COLORS[li] }}>
                            {loc.name}
                          </div>
                          <div className="flex-1 h-7 bg-white/5 rounded-lg overflow-hidden relative">
                            <div
                              className="h-full rounded-lg transition-all duration-700 ease-out"
                              style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: LOCATION_COLORS[li], opacity: 0.75 }}
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-white/80 font-outfit">
                              {loc.value !== null ? loc.value : '—'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
