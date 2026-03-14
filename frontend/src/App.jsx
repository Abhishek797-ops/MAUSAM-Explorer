import React, { useState, useEffect } from 'react';
import { getMetadata, getSpatialData } from './api/client';
import { 
  Globe, 
  Thermometer, 
  TrendingUp,
  Table,
  MapPin,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import LandingPage from './components/LandingPage';
import ClimateProfile from './components/ClimateProfile';
import TimeSeriesTab from './components/TimeSeriesTab';
import DataExplorer from './components/DataExplorer';
import LocationAnalysis from './components/LocationAnalysis';

const TABS = [
  { id: 'climate', label: 'Climate Profile', icon: <Thermometer /> },
  { id: 'timeseries', label: 'Time-Series', icon: <TrendingUp /> },
  { id: 'explorer', label: 'Data Explorer', icon: <Table /> },
  { id: 'location', label: 'Location Analysis', icon: <MapPin /> },
];

export default function App() {
  const [view, setView] = useState('landing');
  const [activeTab, setActiveTab] = useState('climate');
  const [meta, setMeta] = useState(null);
  const [variable, setVariable] = useState('');
  const [timeIndex, setTimeIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [spatialData, setSpatialData] = useState(null);

  const initDashboard = async () => {
    setLoading(true);
    const data = await getMetadata();
    setMeta(data);
    if (data.variables && data.variables.length > 0) {
      setVariable(data.variables[0]);
    }
    setView('dashboard');
    setLoading(false);
  };

  useEffect(() => {
    if (meta && variable && activeTab === 'climate') {
      setLoading(true);
      getSpatialData(variable, timeIndex).then(data => {
        setSpatialData(data);
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  }, [variable, timeIndex, meta, activeTab]);

  if (view === 'landing') {
    return <LandingPage onUploadSuccess={initDashboard} />;
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
              value={variable}
              onChange={(e) => setVariable(e.target.value)}
              className="w-full bg-transparent border border-white/10 rounded-lg p-2 text-[11px] font-bold text-white/70 focus:ring-1 focus:ring-blue-500 transition-all outline-none appearance-none cursor-pointer"
            >
              {meta?.variables.map(v => (
                <option key={v} value={v} className="bg-[#0d1321]">{v}</option>
              ))}
            </select>
          </div>

          {/* Time Slider */}
          <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
            <label className="text-[8px] text-white/25 block mb-2 font-black uppercase tracking-widest flex items-center gap-1">
              <Clock size={8} /> Time Step
            </label>
            <input 
              type="range"
              min="0"
              max={(meta?.total_indices || 1) - 1}
              value={timeIndex}
              onChange={(e) => setTimeIndex(parseInt(e.target.value))}
              className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-blue-400 mb-2"
            />
            <div className="text-[9px] text-blue-400 font-bold text-center bg-blue-500/10 py-1.5 rounded-lg border border-blue-500/10">
              {meta?.times?.[timeIndex] || '—'}
            </div>
          </div>

          {/* Switch Dataset */}
          <button 
            onClick={() => { setView('landing'); setSpatialData(null); setMeta(null); }}
            className="w-full py-3 bg-white/[0.03] hover:bg-white/[0.06] rounded-xl border border-white/5 text-[10px] font-black uppercase tracking-widest text-white/30 transition-all"
          >
            Switch Dataset
          </button>
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
            {variable} · t={timeIndex}
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
              {activeTab === 'climate' && (
                <ClimateProfile
                  spatialData={spatialData}
                  meta={meta}
                  variable={variable}
                  onVariableChange={setVariable}
                  loading={loading}
                />
              )}
              {activeTab === 'timeseries' && (
                <TimeSeriesTab meta={meta} variable={variable} />
              )}
              {activeTab === 'explorer' && (
                <DataExplorer meta={meta} variable={variable} timeIndex={timeIndex} />
              )}
              {activeTab === 'location' && (
                <LocationAnalysis meta={meta} variable={variable} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
