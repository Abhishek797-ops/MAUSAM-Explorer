import React, { useState, useEffect, useMemo } from 'react';
import { getStats, getSpatialData } from '../api/client';
import { CheckSquare, Square, Table, Map, BarChart } from 'lucide-react';

export default function DataExplorer({ meta, variable, timeIndex }) {
  const [stats, setStats] = useState(null);
  const [spatialData, setSpatialData] = useState(null);
  const [selectedVars, setSelectedVars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const rowsPerPage = 100;

  useEffect(() => {
    if (meta?.variables) {
      setSelectedVars(meta.variables.slice(0, 3));
    }
  }, [meta]);

  useEffect(() => {
    if (!variable) return;
    setLoading(true);
    Promise.all([
      getStats(variable),
      getSpatialData(variable, timeIndex || 0)
    ]).then(([statsData, spatial]) => {
      setStats(statsData);
      setSpatialData(spatial);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [variable, timeIndex]);

  // Reset page to 0 if we switch variable/time
  useEffect(() => {
    setPage(0);
  }, [variable, timeIndex]);

  const toggleVar = (v) => {
    setSelectedVars(prev =>
      prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]
    );
  };

  const tableData = useMemo(() => {
    if (!spatialData?.data) return [];
    return spatialData.data.slice(page * rowsPerPage, (page + 1) * rowsPerPage);
  }, [spatialData, page]);

  const totalPages = Math.ceil((spatialData?.data?.length || 0) / rowsPerPage);

  if (loading) {
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

        {/* Summary Statistics */}
        {stats && (
          <div className="p-5">
            <h3 className="text-xs font-black uppercase tracking-widest text-white/40 mb-4">Summary Statistics</h3>
            <div className="space-y-3">
              <StatRow label="Global Mean" value={stats.global_mean} units={stats.units} />
              <StatRow label="Global Max" value={stats.global_max} units={stats.units} color="text-red-400" />
              <StatRow label="Global Min" value={stats.global_min} units={stats.units} color="text-cyan-400" />
              <StatRow label="Std Deviation" value={stats.global_std} units={stats.units} color="text-amber-400" />
              <StatRow label="Total Points" value={stats.total_points?.toLocaleString()} units="" color="text-indigo-400" />
            </div>
          </div>
        )}
      </div>

      {/* Right Panel: Data Table */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <h2 className="text-sm font-bold text-white font-outfit flex items-center gap-2">
            <Table size={16} /> Data Grid — {variable}
          </h2>
          <span className="text-[10px] text-white/30 font-bold">
            Showing {tableData.length} of {spatialData?.data?.length || 0} records
          </span>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#131b2e] border-b border-white/5">
                <th className="text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest text-white/30">#</th>
                <th className="text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest text-white/30">Latitude</th>
                <th className="text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest text-white/30">Longitude</th>
                <th className="text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest text-white/30">Value ({spatialData?.meta?.units})</th>
                <th className="text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest text-white/30">Intensity</th>
              </tr>
            </thead>
            <tbody>
              {tableData.map((row, i) => {
                const t = spatialData?.meta ? (row.value - spatialData.meta.min) / (spatialData.meta.max - spatialData.meta.min) : 0;
                return (
                  <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors">
                    <td className="px-4 py-2.5 text-white/20 font-mono">{i + 1}</td>
                    <td className="px-4 py-2.5 text-white/60 font-mono">{row.lat}°</td>
                    <td className="px-4 py-2.5 text-white/60 font-mono">{row.lon}°</td>
                    <td className="px-4 py-2.5 text-white font-bold font-mono">{row.value}</td>
                    <td className="px-4 py-2.5">
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
