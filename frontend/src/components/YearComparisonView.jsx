import React, { useState, useEffect } from 'react';
import Plot from './PlotlyChart';
import { Search, X, MapPin, Loader, CalendarRange, Table2 } from 'lucide-react';

const YEAR_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];

export default function YearComparisonView({ meta, variable }) {
  const [location, setLocation] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedYears, setSelectedYears] = useState([]);
  const [comparisonData, setComparisonData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeVar, setActiveVar] = useState(variable || '');
  const [showTable, setShowTable] = useState(false);

  // Sync with parent variable on mount
  useEffect(() => { if (variable) setActiveVar(variable); }, [variable]);

  const availableYears = React.useMemo(() => {
    if (!meta?.times) return [];
    const ySet = new Set();
    meta.times.forEach(t => {
      const y = parseInt(String(t).substring(0, 4));
      if (!isNaN(y)) ySet.add(y);
    });
    return [...ySet].sort();
  }, [meta]);

  const searchLocation = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5`,
        { headers: { 'Accept-Language': 'en' } }
      );
      setSearchResults(await res.json());
    } catch { setSearchResults([]); }
    setSearching(false);
  };

  const selectLocation = (result) => {
    setLocation({
      name: result.display_name.split(',')[0],
      lat: parseFloat(result.lat),
      lon: parseFloat(result.lon),
    });
    setSearchResults([]);
    setSearchQuery('');
    setComparisonData(null);
  };

  const toggleYear = (year) => {
    setSelectedYears(prev => {
      if (prev.includes(year)) return prev.filter(y => y !== year);
      if (prev.length >= 5) return prev;
      return [...prev, year].sort();
    });
    setComparisonData(null);
  };

  const runComparison = async (varOverride) => {
    const v = varOverride || activeVar;
    if (!location || selectedYears.length < 2) return;
    setLoading(true);
    try {
      const res = await fetch('/api/compare-years', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: location.lat, lon: location.lon, variable: v, years: selectedYears })
      });
      const data = await res.json();
      setComparisonData(data);
    } catch (err) { console.error('Year comparison failed:', err); }
    setLoading(false);
  };

  // Quick variable switcher — re-fetch with new variable
  const switchVariable = (newVar) => {
    setActiveVar(newVar);
    if (location && selectedYears.length >= 2) {
      runComparison(newVar);
    }
  };

  const buildTraces = () => {
    if (!comparisonData?.years) return [];
    return comparisonData.years.map((yd, i) => ({
      x: yd.months, y: yd.values,
      type: 'scatter', mode: 'lines+markers',
      name: `${yd.year}`,
      line: { color: YEAR_COLORS[i % YEAR_COLORS.length], width: 2.5, shape: 'spline' },
      marker: { size: 5 }
    }));
  };

  // Build table data: months as rows, years as columns
  const allMonths = comparisonData?.years?.[0]?.months || [];

  return (
    <div className="w-full h-full bg-[#0d1321] flex overflow-hidden">
      {/* Left Panel */}
      <div className="w-80 border-r border-white/5 flex flex-col overflow-y-auto">
        <div className="p-5 border-b border-white/5">
          <h3 className="text-xs font-black uppercase tracking-widest text-white/40 mb-2 flex items-center gap-2">
            <CalendarRange size={12} /> Year-over-Year
          </h3>
          <p className="text-[10px] text-white/25 mb-4">Compare the same location across different years</p>

          {/* Quick Variable Switcher */}
          {meta?.variables?.length > 1 && (
            <div className="mb-4">
              <label className="text-[8px] text-white/25 block mb-1.5 font-black uppercase tracking-widest">Variable</label>
              <div className="flex gap-1.5">
                {meta.variables.map(v => (
                  <button key={v} onClick={() => switchVariable(v)}
                    className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all ${
                      activeVar === v
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                        : 'bg-white/[0.04] text-white/30 hover:bg-white/[0.08] hover:text-white/50'
                    }`}
                  >{v}</button>
                ))}
              </div>
            </div>
          )}

          {/* Location Search */}
          <div className="relative mb-4">
            <input type="text" value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchLocation()}
              placeholder="Search a location..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 pl-10 text-xs text-white/80 placeholder-white/20 outline-none focus:ring-1 focus:ring-blue-500"
            />
            {searching ? (
              <Loader size={14} className="absolute left-3 top-3 text-white/20 animate-spin" />
            ) : (
              <Search size={14} className="absolute left-3 top-3 text-white/20 cursor-pointer" onClick={searchLocation} />
            )}
          </div>

          {searchResults.length > 0 && (
            <div className="bg-white/5 rounded-xl border border-white/10 mb-4 overflow-hidden">
              {searchResults.map((r, i) => (
                <button key={i} onClick={() => selectLocation(r)}
                  className="w-full text-left px-4 py-2.5 text-[10px] text-white/60 hover:bg-white/10 transition-all border-b border-white/5 flex items-start gap-2">
                  <MapPin size={10} className="mt-0.5 text-white/25 flex-shrink-0" />
                  {r.display_name}
                </button>
              ))}
            </div>
          )}

          {location && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-blue-400">{location.name}</div>
                <div className="text-[9px] text-white/30">{location.lat.toFixed(2)}, {location.lon.toFixed(2)}</div>
              </div>
              <button onClick={() => { setLocation(null); setComparisonData(null); }}>
                <X size={14} className="text-white/30 hover:text-white" />
              </button>
            </div>
          )}
        </div>

        {/* Year Selection */}
        <div className="p-5 border-b border-white/5">
          <h4 className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-3">Select Years (up to 5)</h4>
          <div className="flex flex-wrap gap-1.5">
            {availableYears.map(y => (
              <button key={y} onClick={() => toggleYear(y)}
                className={`px-2.5 py-1.5 rounded-lg text-[9px] font-bold transition-all ${
                  selectedYears.includes(y)
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : 'bg-white/[0.04] text-white/25 hover:bg-white/[0.08] hover:text-white/50'
                }`}
              >{y}</button>
            ))}
          </div>
          {selectedYears.length > 0 && (
            <div className="mt-3 text-[9px] text-white/30">Selected: {selectedYears.join(', ')}</div>
          )}
        </div>

        {/* Compare Button */}
        <div className="p-5">
          <button onClick={() => runComparison()}
            disabled={!location || selectedYears.length < 2 || loading}
            className={`w-full py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              location && selectedYears.length >= 2
                ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-600/30'
                : 'bg-white/5 text-white/20 cursor-not-allowed'
            }`}
          >
            {loading ? <Loader size={14} className="animate-spin" /> : <CalendarRange size={14} />}
            {loading ? 'Comparing...' : 'Compare Years'}
          </button>
          {!location && <p className="text-[9px] text-amber-400/60 mt-2 text-center">Select a location first</p>}
          {location && selectedYears.length < 2 && <p className="text-[9px] text-amber-400/60 mt-2 text-center">Select at least 2 years</p>}
        </div>

        {/* Stats Summary */}
        {comparisonData?.years && (
          <div className="p-5 border-t border-white/5 space-y-2">
            <h4 className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-2">Summary</h4>
            {comparisonData.years.map((yd, i) => (
              <div key={yd.year} className="flex items-center gap-3 bg-white/[0.03] rounded-lg p-2.5 border border-white/5">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: YEAR_COLORS[i % YEAR_COLORS.length] }} />
                <div className="flex-1">
                  <div className="text-[10px] font-bold text-white/70">{yd.year}</div>
                  <div className="text-[8px] text-white/30">Mean: {yd.mean} · Max: {yd.max} · Min: {yd.min}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right Panel: Chart + Table */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {comparisonData?.years ? (
          <>
            {/* Toggle: Chart / Table */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-white/5">
              <h3 className="text-sm font-bold text-white/70 font-outfit">
                {location?.name} — <span className="text-blue-400">{activeVar}</span>
              </h3>
              <div className="flex gap-2">
                <button onClick={() => setShowTable(false)}
                  className={`px-4 py-1.5 rounded-lg text-[10px] font-bold transition-all ${!showTable ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}
                >Chart</button>
                <button onClick={() => setShowTable(true)}
                  className={`px-4 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5 ${showTable ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}
                ><Table2 size={12} /> Table</button>
              </div>
            </div>

            {!showTable ? (
              /* Chart View */
              <div className="flex-1 p-4">
                <Plot
                  data={buildTraces()}
                  layout={{
                    paper_bgcolor: '#0d1321', plot_bgcolor: '#0d1321',
                    font: { family: 'Inter, sans-serif', color: '#94a3b8', size: 11 },
                    margin: { t: 30, b: 60, l: 60, r: 30 },
                    xaxis: { gridcolor: 'rgba(255,255,255,0.05)', title: { text: 'Month', font: { size: 10, color: '#64748b' } } },
                    yaxis: { gridcolor: 'rgba(255,255,255,0.05)', title: { text: activeVar, font: { size: 10, color: '#64748b' } } },
                    showlegend: true,
                    legend: { font: { color: '#cbd5e1', size: 11 }, bgcolor: 'rgba(0,0,0,0)' },
                    hovermode: 'x unified',
                  }}
                  config={{ responsive: true, displayModeBar: false }}
                  style={{ width: '100%', height: '100%' }}
                  useResizeHandler={true}
                />
              </div>
            ) : (
              /* Table View */
              <div className="flex-1 overflow-auto p-4">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-3 px-4 text-[9px] font-black uppercase tracking-widest text-white/30">Month</th>
                      {comparisonData.years.map((yd, i) => (
                        <th key={yd.year} className="text-right py-3 px-4 text-[9px] font-black uppercase tracking-widest" style={{ color: YEAR_COLORS[i % YEAR_COLORS.length] }}>
                          {yd.year}
                        </th>
                      ))}
                      {comparisonData.years.length >= 2 && (
                        <th className="text-right py-3 px-4 text-[9px] font-black uppercase tracking-widest text-amber-400/60">
                          Δ ({comparisonData.years[0].year}→{comparisonData.years[comparisonData.years.length - 1].year})
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {allMonths.map((month, mi) => {
                      const firstVal = comparisonData.years[0]?.values?.[mi];
                      const lastVal = comparisonData.years[comparisonData.years.length - 1]?.values?.[mi];
                      const diff = (firstVal != null && lastVal != null) ? (lastVal - firstVal).toFixed(2) : '—';
                      const diffNum = parseFloat(diff);
                      return (
                        <tr key={month} className="border-b border-white/5 hover:bg-white/[0.02] transition-all">
                          <td className="py-2.5 px-4 text-white/50 font-bold">{month}</td>
                          {comparisonData.years.map((yd, i) => (
                            <td key={yd.year} className="text-right py-2.5 px-4 font-mono font-bold" style={{ color: YEAR_COLORS[i % YEAR_COLORS.length] + 'cc' }}>
                              {yd.values?.[mi] != null ? yd.values[mi].toFixed(2) : '—'}
                            </td>
                          ))}
                          {comparisonData.years.length >= 2 && (
                            <td className={`text-right py-2.5 px-4 font-mono font-bold ${!isNaN(diffNum) ? (diffNum > 0 ? 'text-red-400' : diffNum < 0 ? 'text-cyan-400' : 'text-white/30') : 'text-white/20'}`}>
                              {!isNaN(diffNum) ? (diffNum > 0 ? '+' : '') + diff : '—'}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                    {/* Summary Row */}
                    <tr className="border-t-2 border-white/10 bg-white/[0.02]">
                      <td className="py-3 px-4 text-white/70 font-black text-[10px] uppercase">Mean</td>
                      {comparisonData.years.map((yd, i) => (
                        <td key={yd.year} className="text-right py-3 px-4 font-mono font-black" style={{ color: YEAR_COLORS[i % YEAR_COLORS.length] }}>
                          {yd.mean}
                        </td>
                      ))}
                      {comparisonData.years.length >= 2 && (() => {
                        const d = (comparisonData.years[comparisonData.years.length - 1].mean - comparisonData.years[0].mean).toFixed(2);
                        const dn = parseFloat(d);
                        return (
                          <td className={`text-right py-3 px-4 font-mono font-black ${dn > 0 ? 'text-red-400' : dn < 0 ? 'text-cyan-400' : 'text-white/30'}`}>
                            {dn > 0 ? '+' : ''}{d}
                          </td>
                        );
                      })()}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <CalendarRange size={48} className="mx-auto text-white/10 mb-4" />
              <h3 className="text-white/30 font-bold text-sm mb-1">Year-over-Year Comparison</h3>
              <p className="text-[10px] text-white/15 max-w-xs">
                Select a location and choose 2-5 years to see how climate data changes across the same months in different years.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
