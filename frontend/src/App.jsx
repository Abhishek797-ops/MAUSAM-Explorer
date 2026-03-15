import React, { useState, useEffect } from 'react';
import { getMetadata, getSpatialData } from './api/client';
import { 
  Globe, 
  Thermometer, 
  TrendingUp,
  Table,
  MapPin,
  Clock,
  Compass,
  Upload
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import ReactSlider from 'react-slider';
import axios from 'axios';

import LandingPage from './components/LandingPage';
import ClimateProfile from './components/ClimateProfile';
import TimeSeriesTab from './components/TimeSeriesTab';
import DataExplorer from './components/DataExplorer';
import LocationAnalysis from './components/LocationAnalysis';

const TABS = [
  { id: 'profile', label: 'Surface Heatmap', icon: <Thermometer /> },
  { id: 'story', label: 'Story Mode', icon: <Compass /> },
  { id: 'timeseries', label: 'Time-Series', icon: <TrendingUp /> },
  { id: 'explorer', label: 'Data Explorer', icon: <Table /> },
  { id: 'location', label: 'Location Analysis', icon: <MapPin /> },
];

export default function App() {
  const [view, setView] = useState('landing');
  const [activeTab, setActiveTab] = useState('profile');
  const [meta, setMeta] = useState(null);
  const [variable, setVariable] = useState(null);
  const [timeIndex, setTimeIndex] = useState(0);
  const [timeRange, setTimeRange] = useState([0, 0]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [loading, setLoading] = useState(false);
  const [spatialData, setSpatialData] = useState(null);
  const [initError, setInitError] = useState(null);
  const [isUploadingSide, setIsUploadingSide] = useState(false);
  const [uploadProgressSide, setUploadProgressSide] = useState(0);

  // Compute unique years and index mapping from meta.times
  const years = React.useMemo(() => {
    if (!meta?.times) return [];
    const ySet = new Set();
    meta.times.forEach(t => {
      const y = String(t).substring(0, 4);
      if (y && !isNaN(parseInt(y))) ySet.add(y);
    });
    return [...ySet].sort();
  }, [meta]);

  const yearIndices = React.useMemo(() => {
    if (!meta?.times || !selectedYear) return { start: 0, end: (meta?.total_indices || 1) - 1 };
    let start = -1, end = -1;
    meta.times.forEach((t, i) => {
      if (String(t).startsWith(selectedYear)) {
        if (start === -1) start = i;
        end = i;
      }
    });
    if (start === -1) return { start: 0, end: (meta?.total_indices || 1) - 1 };
    return { start, end };
  }, [meta, selectedYear]);

  // Auto-select first year when meta loads
  React.useEffect(() => {
    if (years.length > 0 && !selectedYear) {
      setSelectedYear(years[0]);
    }
  }, [years]);

  const handleSidebarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !file.name.endsWith('.nc')) {
      alert("Please select a valid .nc (NetCDF) file.");
      return;
    }
    setIsUploadingSide(true);
    setUploadProgressSide(0);
    const formData = new FormData();
    formData.append("file", file);
    try {
      await axios.post('/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (evt) => {
          if (evt.total) {
            setUploadProgressSide(Math.round((evt.loaded * 100) / evt.total));
          }
        }
      });
      await initDashboard();
    } catch (err) {
      console.error(err);
      alert("Upload failed. Dataset schema might be invalid or file is too large.");
    } finally {
      setIsUploadingSide(false);
      setUploadProgressSide(0);
    }
  };

  const initDashboard = async () => {
    setLoading(true);
    setInitError(null);
    try {
      const data = await getMetadata();
      setMeta(data);
      if (data.variables?.length > 0) {
        setVariable(data.variables[0]);
      }
      if (data.total_indices) {
        setTimeRange([0, data.total_indices - 1]);
      }
      setView('dashboard');
    } catch (error) {
      console.error("Failed to fetch metadata:", error);
      setInitError(error.message || "Failed to load dataset metadata. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (meta && variable && activeTab === 'profile') {
      setLoading(true);
      getSpatialData(variable, [timeIndex, timeIndex]).then(data => {
        setSpatialData(data);
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  }, [variable, timeIndex, meta, activeTab]);

  if (view === 'landing') {
    return (
      <>
        {initError && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-xl shadow-2xl z-50 font-bold text-sm">
            Error: {initError}
          </div>
        )}
        <LandingPage onUploadSuccess={initDashboard} />
      </>
    );
  }

  const currentTab = TABS.find(t => t.id === activeTab);

  return (
    <div className="flex h-screen bg-[#0d1321] font-inter overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-[#080c18] text-white flex flex-col z-20 border-r border-white/5">
        {/* Logo */}
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-500/20 rounded-xl flex items-center justify-center">
              <Globe className="text-blue-400 w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tighter leading-none font-outfit">
                MAUSAM
              </h1>
              <span className="text-blue-400 text-[9px] tracking-[0.2em] font-bold uppercase">Explorer</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          <div className="text-[8px] uppercase tracking-[0.2em] text-white/15 font-black mb-3 ml-3">Dashboard</div>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[12px] font-bold transition-all ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                  : 'text-white/35 hover:bg-white/5 hover:text-white/70'
              }`}
            >
              {React.cloneElement(tab.icon, { size: 16, strokeWidth: 2.5 })}
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Controls */}
        <div className="p-4 space-y-4 border-t border-white/5">
          {/* Variable Selector */}
          <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
            <label className="text-[8px] text-white/25 block mb-2 font-black uppercase tracking-widest">
              Variable
            </label>
            <select 
              value={variable || ''}
              onChange={(e) => setVariable(e.target.value)}
              className="w-full bg-transparent border border-white/10 rounded-lg p-2 text-[11px] font-bold text-white/70 focus:ring-1 focus:ring-blue-500 transition-all outline-none appearance-none cursor-pointer"
            >
              {meta?.variables.map(v => (
                <option key={v} value={v} className="bg-[#0d1321]">{v}</option>
              ))}
            </select>
          </div>

          {/* Time Control */}
          {/* Year Selector */}
          {years.length > 1 && (
            <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
              <label className="text-[8px] text-white/25 block mb-2 font-black uppercase tracking-widest">Year</label>
              <select
                value={selectedYear || ''}
                onChange={(e) => {
                  const y = e.target.value;
                  setSelectedYear(y);
                  const idx = meta.times.findIndex(t => String(t).startsWith(y));
                  if (idx >= 0) {
                    setTimeIndex(idx);
                    setTimeRange([idx, idx]);
                  }
                }}
                className="w-full bg-transparent border border-white/10 rounded-lg p-2 text-[11px] font-bold text-white/70 focus:ring-1 focus:ring-blue-500 transition-all outline-none appearance-none cursor-pointer"
              >
                {years.map(y => (
                  <option key={y} value={y} className="bg-[#0d1321]">{y}</option>
                ))}
              </select>
            </div>
          )}

          {activeTab === 'profile' ? (
            <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
              <label className="text-[8px] text-white/25 block mb-2 font-black uppercase tracking-widest flex items-center gap-1">
                <Clock size={8} /> Month / Time Step
              </label>
              <input 
                type="range"
                min={yearIndices.start}
                max={yearIndices.end}
                value={Math.max(yearIndices.start, Math.min(yearIndices.end, timeIndex))}
                onChange={(e) => setTimeIndex(parseInt(e.target.value))}
                className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-blue-400 mb-2"
              />
              <div className="text-[9px] text-blue-400 font-bold text-center bg-blue-500/10 py-1.5 rounded-lg border border-blue-500/10">
                {meta?.times?.[timeIndex]?.replace('T00:00:00.000000000', '') || '—'}
              </div>
            </div>
          ) : (
            <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
              <label className="text-[8px] text-white/25 block mb-3 font-black uppercase tracking-widest flex items-center gap-1">
                <Clock size={8} /> Time Range
              </label>
              <ReactSlider
                className="w-full h-1 bg-white/10 rounded-full mb-4 relative flex items-center"
                thumbClassName="w-4 h-4 bg-blue-400 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)] cursor-grab active:cursor-grabbing outline-none flex items-center justify-center border-2 border-[#131b2e] -mt-1.5 focus:ring-2 focus:ring-blue-400/50"
                trackClassName="bg-blue-500 h-1 rounded-full"
                min={yearIndices.start}
                max={yearIndices.end}
                value={[
                  Math.max(yearIndices.start, Math.min(yearIndices.end, timeRange[0])),
                  Math.max(yearIndices.start, Math.min(yearIndices.end, timeRange[1]))
                ]}
                onChange={setTimeRange}
                pearling
                minDistance={0}
              />
              <div className="text-[9px] text-blue-400 font-bold text-center bg-blue-500/10 py-1.5 rounded-lg border border-blue-500/10 flex justify-between px-2">
                <span>{meta?.times?.[timeRange[0]]?.replace('T00:00:00.000000000', '') || '—'}</span>
                <span className="text-white/20 px-2">to</span>
                <span>{meta?.times?.[timeRange[1]]?.replace('T00:00:00.000000000', '') || '—'}</span>
              </div>
            </div>
          )}

          {/* Dataset Controls */}
          <div className="flex flex-col gap-2">
            <label className={`w-full py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest text-center transition-all ${
              isUploadingSide 
                ? 'bg-blue-500/50 border-blue-500/50 text-white cursor-wait relative overflow-hidden' 
                : 'bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/20 text-blue-400 cursor-pointer'
            }`}>
              {isUploadingSide ? (
                <>
                  <span className="relative z-10">Uploading... {uploadProgressSide}%</span>
                  <div className="absolute top-0 left-0 h-full bg-blue-500 transition-all duration-300 ease-out" style={{ width: `${uploadProgressSide}%` }} />
                </>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Upload size={12} /> Upload Dataset
                </span>
              )}
              <input type="file" accept=".nc" className="hidden" onChange={handleSidebarUpload} disabled={isUploadingSide} />
            </label>
            <button 
              onClick={() => { setView('landing'); setSpatialData(null); setMeta(null); }}
              className="w-full py-2 bg-white/[0.03] hover:bg-white/[0.06] rounded-xl border border-white/5 text-[10px] font-black uppercase tracking-widest text-white/30 transition-all"
            >
              Back to Start
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 relative flex flex-col overflow-hidden min-w-0">
        {/* Top bar */}
        <header className="h-14 bg-[#0d1321] border-b border-white/5 flex items-center justify-between px-6 shrink-0 z-10">
          <div className="flex items-center gap-3">
            {currentTab && React.cloneElement(currentTab.icon, { size: 16, className: 'text-blue-400' })}
            <h2 className="text-sm font-bold text-white/80 font-outfit">{currentTab?.label}</h2>
            <span className="inline-flex items-center gap-1.5 text-[9px] text-white/20 font-bold ml-4">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]" />
              Live
            </span>
          </div>
          <div className="text-[10px] text-white/20 font-bold">
            {variable} · 
            {activeTab === 'profile' ? (
              <span> t={timeIndex}</span>
            ) : (
              <span> <span className="text-blue-400">Mean</span> over {timeRange[1] - timeRange[0] + 1} steps</span>
            )}
          </div>
        </header>

        {/* Tab Content */}
        <div className="flex-1 relative min-h-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 w-full h-full"
            >
              {(activeTab === 'profile' || activeTab === 'story') && (
                <ClimateProfile 
                  spatialData={spatialData} 
                  meta={meta} 
                  variable={variable} 
                  timeRange={[timeIndex, timeIndex]} 
                  onVariableChange={setVariable} 
                  isStoryMode={activeTab === 'story'}
                  setAppTimeIndex={setTimeIndex}
                  setAppActiveTab={setActiveTab}
                />
              )}
              {activeTab === 'timeseries' && (
                <TimeSeriesTab meta={meta} variable={variable} timeRange={timeRange} />
              )}
              {activeTab === 'explorer' && (
                <DataExplorer meta={meta} variable={variable} onVariableChange={setVariable} timeRange={timeRange} />
              )}
              {activeTab === 'location' && (
                <LocationAnalysis meta={meta} variable={variable} timeRange={timeRange} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
