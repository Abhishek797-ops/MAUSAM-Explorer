import React, { useState, useEffect } from 'react';
import Plot from './PlotlyChart';
import ComparisonView from './ComparisonView';
import YearComparisonView from './YearComparisonView';
import { getStats } from '../api/client';
import { TrendingUp, BarChart3, Activity, GitCompareArrows, CalendarRange } from 'lucide-react';

export default function TimeSeriesTab({ meta, variable, timeRange }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chartType, setChartType] = useState('line');

  useEffect(() => {
    if (!variable) return;
    setLoading(true);
    getStats(variable).then(data => {
      setStats(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [variable]);

  if (loading || !stats) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#0d1321]">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const slicedTimes = stats.times.slice(timeRange[0], timeRange[1] + 1);
  const slicedMeans = stats.time_means.slice(timeRange[0], timeRange[1] + 1);

  const lineTrace = {
    x: slicedTimes,
    y: slicedMeans,
    type: 'scatter',
    mode: 'lines',
    name: `${stats.long_name} (Global Mean)`,
    line: { color: '#3b82f6', width: 2.5, shape: 'spline' },
    fill: 'tozeroy',
    fillcolor: 'rgba(59,130,246,0.08)',
  };

  const barTrace = {
    x: slicedTimes,
    y: slicedMeans,
    type: 'bar',
    name: `${stats.long_name}`,
    marker: {
      color: slicedMeans.map(v => {
        const t = (v - stats.global_min) / (stats.global_max - stats.global_min);
        return `rgba(${Math.round(t * 255)}, ${Math.round((1 - t) * 120 + 80)}, ${Math.round((1 - t) * 255)}, 0.85)`;
      })
    },
  };

  // Compute anomalies (deviation from global mean)
  const anomalyTrace = {
    x: slicedTimes,
    y: slicedMeans.map(v => v !== null ? +(v - stats.global_mean).toFixed(3) : null),
    type: 'bar',
    name: 'Anomaly',
    marker: {
      color: slicedMeans.map(v => v !== null && v > stats.global_mean ? 'rgba(239,68,68,0.7)' : 'rgba(59,130,246,0.7)')
    },
  };

  const traces = chartType === 'line' ? [lineTrace] : chartType === 'bar' ? [barTrace] : [anomalyTrace];

  const layout = {
    paper_bgcolor: '#0d1321',
    plot_bgcolor: '#0d1321',
    font: { family: 'Inter, sans-serif', color: '#94a3b8', size: 11 },
    margin: { t: 40, b: 60, l: 60, r: 30 },
    xaxis: {
      gridcolor: 'rgba(255,255,255,0.05)',
      title: { text: 'Date', font: { size: 10, color: '#64748b' } },
    },
    yaxis: {
      gridcolor: 'rgba(255,255,255,0.05)',
      title: { text: `${stats.long_name} (${stats.units})`, font: { size: 10, color: '#64748b' } },
    },
    title: {
      text: `${stats.long_name} — Global Mean Over Time`,
      font: { size: 14, color: '#e2e8f0', family: 'Outfit, sans-serif' },
      x: 0.02, xanchor: 'left'
    },
    showlegend: false,
    hovermode: 'x unified',
  };

  return (
    <div className="w-full h-full bg-[#0d1321] flex flex-col overflow-hidden">
      {/* Header Controls */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <h2 className="text-lg font-bold text-white font-outfit">Time-Series Analysis</h2>
        <div className="flex gap-2">
          {[
            { id: 'line', icon: <TrendingUp size={14} />, label: 'Trend' },
            { id: 'bar', icon: <BarChart3 size={14} />, label: 'Distribution' },
            { id: 'anomaly', icon: <Activity size={14} />, label: 'Anomaly' },
            { id: 'compare', icon: <GitCompareArrows size={14} />, label: 'Compare' },
            { id: 'yearcompare', icon: <CalendarRange size={14} />, label: 'Year Compare' },
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => setChartType(opt.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                chartType === opt.id
                  ? 'bg-blue-500 text-white shadow-lg'
                  : 'bg-white/5 text-white/50 hover:bg-white/10'
              }`}
            >
              {opt.icon} {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      {chartType === 'compare' ? (
        <ComparisonView meta={meta} timeRange={timeRange} />
      ) : chartType === 'yearcompare' ? (
        <YearComparisonView meta={meta} variable={variable} />
      ) : (
        <>
          {/* Main Chart */}
          <div className="flex-1 p-4">
            <Plot
              data={traces}
              layout={layout}
              config={{ responsive: true, displayModeBar: false }}
              style={{ width: '100%', height: '100%' }}
              useResizeHandler={true}
            />
          </div>

          {/* Summary Stats Footer */}
          <div className="flex gap-4 px-6 py-4 border-t border-white/5">
            <FooterStat label="Global Mean" value={stats.global_mean} units={stats.units} />
            <FooterStat label="Global Max" value={stats.global_max} units={stats.units} color="text-red-400" />
            <FooterStat label="Global Min" value={stats.global_min} units={stats.units} color="text-cyan-400" />
            <FooterStat label="Std Dev" value={stats.global_std} units={stats.units} color="text-amber-400" />
            <FooterStat label="Data Points" value={stats.total_points.toLocaleString()} units="" color="text-indigo-400" />
          </div>
        </>
      )}
    </div>
  );
}

function FooterStat({ label, value, units, color = "text-blue-400" }) {
  return (
    <div className="bg-white/5 px-4 py-2.5 rounded-xl border border-white/5 flex-1">
      <div className="text-[8px] font-black uppercase tracking-widest text-white/25">{label}</div>
      <div className={`text-sm font-black font-outfit ${color}`}>
        {value} <span className="text-[9px] text-white/30">{units}</span>
      </div>
    </div>
  );
}
