import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getStats, getSpatialData } from '../api/client';
import { CheckSquare, Square, Table, BarChart } from 'lucide-react';

export default function DataExplorer({ meta, variable, onVariableChange, timeRange }) {
  // Cache: { varName: { stats, spatial } }
  const [dataCache, setDataCache] = useState({});
  const [selectedVars, setSelectedVars] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const rowsPerPage = 100;
  const initialized = useRef(false);

  // Initialize selectedVars once from meta
  useEffect(() => {
    if (meta?.variables && !initialized.current) {
      setSelectedVars(meta.variables.slice(0, 1)); // Start with first var selected
      initialized.current = true;
    }
  }, [meta]);

  // Clear cache and force refetch when time range changes
  useEffect(() => {
    setDataCache({});
  }, [timeRange]);

  // Fetch data for any selected vars not yet in cache
  useEffect(() => {
    if (selectedVars.length === 0) return;
    const missing = selectedVars.filter(v => !dataCache[v]);
    if (missing.length === 0) return;

    setLoading(true);
    Promise.all(missing.map(v =>
      Promise.all([getStats(v), getSpatialData(v, timeRange || [0, 0])])
        .then(([stats, spatial]) => ({ varName: v, stats, spatial }))
    )).then(results => {
      setDataCache(prev => {
        const next = { ...prev };
        results.forEach(r => { next[r.varName] = { stats: r.stats, spatial: r.spatial }; });
        return next;
      });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [selectedVars, timeRange]);

  // Reset page on variable change
  useEffect(() => { setPage(0); }, [selectedVars]);

  // Sync global variable into selectedVars if it changes from the top dropdown
  useEffect(() => {
    if (variable && !selectedVars.includes(variable) && initialized.current) {
      setSelectedVars(prev => [...prev, variable]);
    }
  }, [variable]);

  const toggleVar = (v) => {
    setSelectedVars(prev => {
      if (prev.includes(v)) {
        const next = prev.filter(x => x !== v);
        // If user unchecks the active global variable, fallback to another selected one
        if (v === variable && next.length > 0 && onVariableChange) {
          onVariableChange(next[0]);
        }
        return next;
      } else {
        // Checking a new variable also makes it the primary view
        if (onVariableChange) onVariableChange(v);
        return [...prev, v];
      }
    });
  };

  // The "primary" variable is the globally selected one — used for stats
  const primaryVar = variable || selectedVars[0] || null;
  const primaryData = primaryVar ? dataCache[primaryVar] : null;
  const primaryStats = primaryData?.stats || null;
  const primarySpatial = primaryData?.spatial || null;

  // Build table rows: lat/lon from the primary variable, values from all selected
  const tableData = useMemo(() => {
    if (!primarySpatial?.data) return [];
    const slice = primarySpatial.data.slice(page * rowsPerPage, (page + 1) * rowsPerPage);
    return slice.map((row, i) => {
      const idx = page * rowsPerPage + i;
      const values = {};
      selectedVars.forEach(v => {
        const vData = dataCache[v]?.spatial?.data;
        values[v] = vData ? vData[idx]?.value : undefined;
      });
      return { lat: row.lat, lon: row.lon, values };
    });
  }, [dataCache, selectedVars, primarySpatial, page]);

  const totalPoints = primarySpatial?.data?.length || 0;
  const totalPages = Math.ceil(totalPoints / rowsPerPage);

  if (loading && !primaryData) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#0d1321]">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-[#0d1321] flex overflow-hidden">
      {/* Left Panel: Variable Selection + Stats */}
      <div className="w-80 border-r border-white/5 flex flex-col overflow-y-auto">
        {/* Variable Selection */}
        <div className="p-5 border-b border-white/5">
          <h3 className="text-xs font-black uppercase tracking-widest text-white/40 mb-4 flex items-center gap-2">
            <BarChart size={12} /> Variable Selection
          </h3>
          <div className="space-y-2">
            {meta?.variables?.map(v => (
              <button
                key={v}
                onClick={() => toggleVar(v)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  selectedVars.includes(v) 
                    ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                    : 'text-white/40 hover:bg-white/5 border border-transparent'
                }`}
              >
                {selectedVars.includes(v) ? <CheckSquare size={14} /> : <Square size={14} />}
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Summary Statistics — shows stats for the primary (first) selected var */}
        {primaryStats && (
          <div className="p-5">
            <h3 className="text-xs font-black uppercase tracking-widest text-white/40 mb-4 flex items-center justify-between">
              Summary Statistics
              <span className="text-[9px] text-blue-400 normal-case tracking-normal">{primaryVar}</span>
            </h3>
            <div className="space-y-3">
              <StatRow label="Global Mean" value={primaryStats.global_mean} units={primaryStats.units} />
              <StatRow label="Global Max" value={primaryStats.global_max} units={primaryStats.units} color="text-red-400" />
              <StatRow label="Global Min" value={primaryStats.global_min} units={primaryStats.units} color="text-cyan-400" />
              <StatRow label="Std Deviation" value={primaryStats.global_std} units={primaryStats.units} color="text-amber-400" />
              <StatRow label="Total Points" value={primaryStats.total_points?.toLocaleString()} units="" color="text-indigo-400" />
            </div>
          </div>
        )}
      </div>

      {/* Right Panel: Data Table */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <h2 className="text-sm font-bold text-white font-outfit flex items-center gap-2">
            <Table size={16} /> Data Grid {selectedVars.length > 1 ? `(${selectedVars.length} Variables)` : `— ${primaryVar || '...'}`}
          </h2>
          <span className="text-[10px] text-white/30 font-bold">
            Showing {tableData.length} of {totalPoints.toLocaleString()} records
          </span>
        </div>

        {selectedVars.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-white/20 text-sm font-bold">
            Select at least one variable to view data
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#131b2e] border-b border-white/5">
                  <th className="text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest text-white/30">#</th>
                  <th className="text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest text-white/30">Latitude</th>
                  <th className="text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest text-white/30">Longitude</th>
                  {selectedVars.map(v => (
                    <th key={v} className="text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest text-blue-400 border-l border-white/5">
                      {v} ({dataCache[v]?.spatial?.meta?.units || '—'})
                    </th>
                  ))}
                  <th className="text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest text-white/30 border-l border-white/5">Intensity</th>
                </tr>
              </thead>
              <tbody>
                {tableData.map((row, i) => {
                  const pMeta = primarySpatial?.meta;
                  const pVal = row.values[primaryVar];
                  const t = (pMeta && pVal !== undefined) 
                    ? Math.max(0, Math.min(1, (pVal - pMeta.min) / (pMeta.max - pMeta.min))) 
                    : 0;
                  return (
                    <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors">
                      <td className="px-4 py-2.5 text-white/20 font-mono">{page * rowsPerPage + i + 1}</td>
                      <td className="px-4 py-2.5 text-white/60 font-mono">{row.lat}°</td>
                      <td className="px-4 py-2.5 text-white/60 font-mono">{row.lon}°</td>
                      {selectedVars.map(v => (
                        <td key={v} className="px-4 py-2.5 text-white font-bold font-mono border-l border-white/[0.02]">
                          {row.values[v] ?? '—'}
                        </td>
                      ))}
                      <td className="px-4 py-2.5 border-l border-white/[0.02]">
                        <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-500 via-yellow-400 to-red-500"
                            style={{ width: `${Math.round(t * 100)}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 0 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-white/5 bg-[#0d1321] shrink-0">
            <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider">
              Page {page + 1} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button 
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-[10px] font-bold text-white transition-colors"
              >
                Previous
              </button>
              <button 
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page === totalPages - 1}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-[10px] font-bold text-white shadow-lg transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatRow({ label, value, units, color = "text-blue-400" }) {
  return (
    <div className="flex items-center justify-between bg-white/[0.03] px-3 py-2.5 rounded-xl">
      <span className="text-[10px] text-white/40 font-bold">{label}</span>
      <span className={`text-sm font-black font-outfit ${color}`}>
        {value} <span className="text-[9px] text-white/20">{units}</span>
      </span>
    </div>
  );
}
